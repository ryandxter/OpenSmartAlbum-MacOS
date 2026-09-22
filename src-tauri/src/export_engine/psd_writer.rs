use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use image::{ImageBuffer, Luma, Rgba, RgbaImage};

/// PackBits run-length encoding for a single scanline byte row.
///
/// Follows standard Apple/Adobe PackBits specification:
/// - Replicate run (2 to 128 occurrences of identical byte):
///   emit `-(count - 1)` as i8, followed by the repeated byte.
/// - Literal run (1 to 128 non-repeated bytes):
///   emit `(count - 1)` as i8, followed by the literal bytes.
pub fn packbits_encode_row(src: &[u8]) -> Vec<u8> {
    if src.is_empty() {
        return Vec::new();
    }
    let mut dest = Vec::with_capacity(src.len() + (src.len() / 128) + 2);
    let mut i = 0;
    while i < src.len() {
        // Find identical byte run length (up to 128 bytes)
        let mut run_len = 1;
        while i + run_len < src.len() && run_len < 128 && src[i + run_len] == src[i] {
            run_len += 1;
        }

        // Favor replicate run if 3+ identical, or 2 identical at the very end of row
        if run_len >= 3 || (run_len == 2 && i + run_len == src.len()) {
            let count_byte = (1 - (run_len as i16)) as i8 as u8;
            dest.push(count_byte);
            dest.push(src[i]);
            i += run_len;
        } else {
            // Literal run: collect non-replicate bytes up to 128 or until next 3+ replicate run
            let mut lit_len = 0;
            while i + lit_len < src.len() && lit_len < 128 {
                let rem = src.len() - (i + lit_len);
                if rem >= 3
                    && src[i + lit_len] == src[i + lit_len + 1]
                    && src[i + lit_len] == src[i + lit_len + 2]
                {
                    break;
                }
                lit_len += 1;
            }
            if lit_len > 0 {
                let count_byte = (lit_len - 1) as u8;
                dest.push(count_byte);
                dest.extend_from_slice(&src[i..i + lit_len]);
                i += lit_len;
            }
        }
    }
    dest
}

/// PackBits decoding for a single scanline byte row.
#[allow(dead_code)]
pub fn packbits_decode_row(src: &[u8], expected_len: usize) -> Result<Vec<u8>, String> {
    let mut dest = Vec::with_capacity(expected_len);
    let mut i = 0;
    while i < src.len() && dest.len() < expected_len {
        let b = src[i] as i8;
        i += 1;
        if b >= 0 {
            let count = (b as usize) + 1;
            if i + count > src.len() {
                return Err("PackBits literal run exceeds input buffer".to_string());
            }
            dest.extend_from_slice(&src[i..i + count]);
            i += count;
        } else if b != -128 {
            let count = (1 - (b as i32)) as usize;
            if i >= src.len() {
                return Err("PackBits replicate run missing target byte".to_string());
            }
            let val = src[i];
            i += 1;
            dest.resize(dest.len() + count, val);
        }
        // -128 is a no-op
    }
    Ok(dest)
}

// ============================================================================
// Shape Mask Generation (Grayscale Luma8 for Channel ID -2)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

/// Computes anti-aliased corner coverage for rounded rectangles.
pub fn compute_corner_alpha(
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    rtl: f64,
    rtr: f64,
    rbr: f64,
    rbl: f64,
) -> f64 {
    if rtl > 0.5 && x < rtl && y < rtl {
        let dx = x - rtl;
        let dy = y - rtl;
        let d = (dx * dx + dy * dy).sqrt();
        return (rtl + 0.5 - d).clamp(0.0, 1.0);
    }
    if rtr > 0.5 && x >= w - rtr && y < rtr {
        let dx = x - (w - rtr);
        let dy = y - rtr;
        let d = (dx * dx + dy * dy).sqrt();
        return (rtr + 0.5 - d).clamp(0.0, 1.0);
    }
    if rbr > 0.5 && x >= w - rbr && y >= h - rbr {
        let dx = x - (w - rbr);
        let dy = y - (h - rbr);
        let d = (dx * dx + dy * dy).sqrt();
        return (rbr + 0.5 - d).clamp(0.0, 1.0);
    }
    if rbl > 0.5 && x < rbl && y >= h - rbl {
        let dx = x - rbl;
        let dy = y - (h - rbl);
        let d = (dx * dx + dy * dy).sqrt();
        return (rbl + 0.5 - d).clamp(0.0, 1.0);
    }
    1.0
}

/// Renders a high-quality anti-aliased mask for arbitrary closed polygons using 4x sub-scanlines.
pub fn rasterize_polygon_mask(w: u32, h: u32, vertices: &[Point2D]) -> ImageBuffer<Luma<u8>, Vec<u8>> {
    let mut mask = ImageBuffer::new(w, h);
    if vertices.len() < 3 || w == 0 || h == 0 {
        return mask;
    }

    let sub_offsets = [0.125, 0.375, 0.625, 0.875];
    let n = vertices.len();

    let mut intersections = Vec::new();

    for py in 0..h {
        let mut row_coverage = vec![0.0f64; w as usize];

        for &sub_dy in &sub_offsets {
            let scan_y = py as f64 + sub_dy;
            intersections.clear();

            for i in 0..n {
                let p1 = vertices[i];
                let p2 = vertices[(i + 1) % n];

                let (min_y, max_y) = if p1.y < p2.y { (p1.y, p2.y) } else { (p2.y, p1.y) };
                if scan_y >= min_y && scan_y < max_y {
                    let dy = p2.y - p1.y;
                    if dy.abs() > 1e-9 {
                        let t = (scan_y - p1.y) / dy;
                        let x = p1.x + t * (p2.x - p1.x);
                        intersections.push(x);
                    }
                }
            }

            intersections.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

            // Even-odd pairing
            for chunk in intersections.chunks_exact(2) {
                let x_start = chunk[0].clamp(0.0, w as f64);
                let x_end = chunk[1].clamp(0.0, w as f64);
                if x_end <= x_start {
                    continue;
                }

                let px_min = x_start.floor() as usize;
                let px_max = (x_end.ceil() as usize).min(w as usize);

                for px in px_min..px_max {
                    let cell_left = px as f64;
                    let cell_right = cell_left + 1.0;
                    let overlap = (cell_right.min(x_end) - cell_left.max(x_start)).max(0.0);
                    row_coverage[px] += overlap * 0.25;
                }
            }
        }

        for px in 0..w as usize {
            let cov = row_coverage[px].clamp(0.0, 1.0);
            let val = (cov * 255.0).round() as u8;
            mask.put_pixel(px as u32, py, Luma([val]));
        }
    }

    mask
}

/// Generates a regular polygon (Hexagon: 6, Octagon: 8).
pub fn generate_polygon_mask(sides: usize, w: u32, h: u32) -> ImageBuffer<Luma<u8>, Vec<u8>> {
    let rx = w as f64 / 2.0;
    let ry = h as f64 / 2.0;
    let cx = rx;
    let cy = ry;

    let mut vertices = Vec::with_capacity(sides);
    for i in 0..sides {
        let angle = (i as f64 * 2.0 * std::f64::consts::PI) / (sides as f64) - std::f64::consts::PI / 2.0;
        vertices.push(Point2D {
            x: cx + rx * angle.cos(),
            y: cy + ry * angle.sin(),
        });
    }
    rasterize_polygon_mask(w, h, &vertices)
}

/// Generates a 5-point star mask with configurable inner radius ratio.
pub fn generate_star_mask(points: usize, inner_ratio: f64, w: u32, h: u32) -> ImageBuffer<Luma<u8>, Vec<u8>> {
    let rx = w as f64 / 2.0;
    let ry = h as f64 / 2.0;
    let cx = rx;
    let cy = ry;

    let total_steps = points * 2;
    let mut vertices = Vec::with_capacity(total_steps);
    for i in 0..total_steps {
        let angle = (i as f64 * std::f64::consts::PI) / (points as f64) - std::f64::consts::PI / 2.0;
        let is_inner = i % 2 != 0;
        let crx = if is_inner { rx * inner_ratio } else { rx };
        let cry = if is_inner { ry * inner_ratio } else { ry };
        vertices.push(Point2D {
            x: cx + crx * angle.cos(),
            y: cy + cry * angle.sin(),
        });
    }
    rasterize_polygon_mask(w, h, &vertices)
}

/// Evaluates a cubic bezier curve point at parameter t in [0.0, 1.0].
fn sample_cubic_bezier(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: f64) -> Point2D {
    let u = 1.0 - t;
    let tt = t * t;
    let uu = u * u;
    let uuu = uu * u;
    let ttt = tt * t;

    Point2D {
        x: uuu * p0.x + 3.0 * uu * t * p1.x + 3.0 * u * tt * p2.x + ttt * p3.x,
        y: uuu * p0.y + 3.0 * uu * t * p1.y + 3.0 * u * tt * p2.y + ttt * p3.y,
    }
}

/// Evaluates a quadratic bezier curve point at parameter t in [0.0, 1.0].
fn sample_quadratic_bezier(p0: Point2D, p1: Point2D, p2: Point2D, t: f64) -> Point2D {
    let u = 1.0 - t;
    Point2D {
        x: u * u * p0.x + 2.0 * u * t * p1.x + t * t * p2.x,
        y: u * u * p0.y + 2.0 * u * t * p1.y + t * t * p2.y,
    }
}

/// Generates a smooth, symmetrical heart shape mask matching the domain model.
pub fn generate_heart_mask(w: u32, h: u32) -> ImageBuffer<Luma<u8>, Vec<u8>> {
    let wf = w as f64;
    let hf = h as f64;

    // 4 cubic beziers defining a smooth heart
    let curves = [
        (
            Point2D { x: wf * 0.5, y: hf * 0.82 },
            Point2D { x: wf * 0.15, y: hf * 0.55 },
            Point2D { x: 0.0, y: hf * 0.28 },
            Point2D { x: wf * 0.25, y: hf * 0.12 },
        ),
        (
            Point2D { x: wf * 0.25, y: hf * 0.12 },
            Point2D { x: wf * 0.42, y: hf * 0.02 },
            Point2D { x: wf * 0.5, y: hf * 0.25 },
            Point2D { x: wf * 0.5, y: hf * 0.25 },
        ),
        (
            Point2D { x: wf * 0.5, y: hf * 0.25 },
            Point2D { x: wf * 0.58, y: hf * 0.02 },
            Point2D { x: wf * 0.75, y: hf * 0.12 },
            Point2D { x: wf * 0.75, y: hf * 0.12 },
        ),
        (
            Point2D { x: wf * 0.75, y: hf * 0.12 },
            Point2D { x: wf * 1.0, y: hf * 0.28 },
            Point2D { x: wf * 0.85, y: hf * 0.55 },
            Point2D { x: wf * 0.5, y: hf * 0.82 },
        ),
    ];

    let mut vertices = Vec::new();
    let samples_per_curve = 16;
    for (p0, p1, p2, p3) in curves {
        for s in 0..samples_per_curve {
            let t = s as f64 / samples_per_curve as f64;
            vertices.push(sample_cubic_bezier(p0, p1, p2, p3, t));
        }
    }

    rasterize_polygon_mask(w, h, &vertices)
}

/// Generates a decorative fluted scallop / cloud contour mask.
pub fn generate_scallop_mask(scallops: usize, w: u32, h: u32) -> ImageBuffer<Luma<u8>, Vec<u8>> {
    let rx = w as f64 / 2.0;
    let ry = h as f64 / 2.0;
    let cx = rx;
    let cy = ry;

    let steps = scallops.max(6);
    let step_angle = (2.0 * std::f64::consts::PI) / steps as f64;
    let bulge = 1.15;

    let mut vertices = Vec::new();
    let samples_per_scallop = 8;

    for i in 0..steps {
        let a1 = i as f64 * step_angle - std::f64::consts::PI / 2.0;
        let a2 = (i + 1) as f64 * step_angle - std::f64::consts::PI / 2.0;
        let mid_angle = (a1 + a2) / 2.0;

        let p0 = Point2D { x: cx + rx * a1.cos(), y: cy + ry * a1.sin() };
        let cp = Point2D { x: cx + rx * bulge * mid_angle.cos(), y: cy + ry * bulge * mid_angle.sin() };
        let p2 = Point2D { x: cx + rx * a2.cos(), y: cy + ry * a2.sin() };

        for s in 0..samples_per_scallop {
            let t = s as f64 / samples_per_scallop as f64;
            vertices.push(sample_quadratic_bezier(p0, cp, p2, t));
        }
    }

    rasterize_polygon_mask(w, h, &vertices)
}

/// Generates an analytical anti-aliased circle mask.
pub fn generate_circle_mask(w: u32, h: u32) -> ImageBuffer<Luma<u8>, Vec<u8>> {
    let mut mask = ImageBuffer::new(w, h);
    let cx = w as f64 / 2.0;
    let cy = h as f64 / 2.0;
    let r = cx.min(cy);

    for y in 0..h {
        let dy = y as f64 + 0.5 - cy;
        for x in 0..w {
            let dx = x as f64 + 0.5 - cx;
            let dist = (dx * dx + dy * dy).sqrt();
            let alpha = (r + 0.5 - dist).clamp(0.0, 1.0);
            mask.put_pixel(x, y, Luma([(alpha * 255.0).round() as u8]));
        }
    }
    mask
}

/// Generates an analytical anti-aliased oval/ellipse mask.
pub fn generate_oval_mask(w: u32, h: u32) -> ImageBuffer<Luma<u8>, Vec<u8>> {
    let mut mask = ImageBuffer::new(w, h);
    let cx = w as f64 / 2.0;
    let cy = h as f64 / 2.0;
    let rx = cx.max(1.0);
    let ry = cy.max(1.0);

    for y in 0..h {
        let dy = y as f64 + 0.5 - cy;
        for x in 0..w {
            let dx = x as f64 + 0.5 - cx;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist < 1e-6 {
                mask.put_pixel(x, y, Luma([255]));
                continue;
            }
            let cos_t = dx / dist;
            let sin_t = dy / dist;
            let r_bound = 1.0 / ((cos_t / rx).powi(2) + (sin_t / ry).powi(2)).sqrt();
            let alpha = (r_bound + 0.5 - dist).clamp(0.0, 1.0);
            mask.put_pixel(x, y, Luma([(alpha * 255.0).round() as u8]));
        }
    }
    mask
}

/// Generates an analytical rounded rectangle mask with per-corner radii.
pub fn generate_rounded_rect_mask(
    w: u32,
    h: u32,
    rtl: f64,
    rtr: f64,
    rbr: f64,
    rbl: f64,
) -> ImageBuffer<Luma<u8>, Vec<u8>> {
    let mut mask = ImageBuffer::new(w, h);
    let wf = w as f64;
    let hf = h as f64;

    for y in 0..h {
        let py = y as f64 + 0.5;
        for x in 0..w {
            let px = x as f64 + 0.5;
            let alpha = compute_corner_alpha(px, py, wf, hf, rtl, rtr, rbr, rbl);
            mask.put_pixel(x, y, Luma([(alpha * 255.0).round() as u8]));
        }
    }
    mask
}

/// Lightweight tokenizer & parser for custom SVG path strings, scaled to (w, h).
pub fn generate_custom_svg_mask(path_str: &str, w: u32, h: u32) -> ImageBuffer<Luma<u8>, Vec<u8>> {
    let mut tokens = Vec::new();
    let mut cur_num = String::new();

    for ch in path_str.chars() {
        if ch.is_ascii_alphabetic() {
            if !cur_num.is_empty() {
                if let Ok(val) = cur_num.parse::<f64>() {
                    tokens.push(SvgToken::Num(val));
                }
                cur_num.clear();
            }
            tokens.push(SvgToken::Cmd(ch));
        } else if ch.is_ascii_digit() || ch == '.' || ch == '-' || ch == '+' {
            if (ch == '-' || ch == '+') && !cur_num.is_empty() && !cur_num.ends_with('e') && !cur_num.ends_with('E') {
                if let Ok(val) = cur_num.parse::<f64>() {
                    tokens.push(SvgToken::Num(val));
                }
                cur_num.clear();
            }
            cur_num.push(ch);
        } else {
            if !cur_num.is_empty() {
                if let Ok(val) = cur_num.parse::<f64>() {
                    tokens.push(SvgToken::Num(val));
                }
                cur_num.clear();
            }
        }
    }
    if !cur_num.is_empty() {
        if let Ok(val) = cur_num.parse::<f64>() {
            tokens.push(SvgToken::Num(val));
        }
    }

    #[derive(Debug)]
    enum SvgToken {
        Cmd(char),
        Num(f64),
    }

    let mut raw_vertices = Vec::new();
    let mut cur = Point2D { x: 0.0, y: 0.0 };
    let mut start = Point2D { x: 0.0, y: 0.0 };
    let mut idx = 0;

    while idx < tokens.len() {
        if let SvgToken::Cmd(cmd) = tokens[idx] {
            idx += 1;
            match cmd {
                'M' | 'm' => {
                    let is_rel = cmd == 'm';
                    if idx + 1 < tokens.len() {
                        if let (SvgToken::Num(x), SvgToken::Num(y)) = (&tokens[idx], &tokens[idx + 1]) {
                            cur = if is_rel { Point2D { x: cur.x + x, y: cur.y + y } } else { Point2D { x: *x, y: *y } };
                            start = cur;
                            raw_vertices.push(cur);
                            idx += 2;
                        }
                    }
                }
                'L' | 'l' => {
                    let is_rel = cmd == 'l';
                    while idx + 1 < tokens.len() {
                        if let (SvgToken::Num(x), SvgToken::Num(y)) = (&tokens[idx], &tokens[idx + 1]) {
                            cur = if is_rel { Point2D { x: cur.x + x, y: cur.y + y } } else { Point2D { x: *x, y: *y } };
                            raw_vertices.push(cur);
                            idx += 2;
                        } else {
                            break;
                        }
                    }
                }
                'H' | 'h' => {
                    let is_rel = cmd == 'h';
                    if idx < tokens.len() {
                        if let SvgToken::Num(x) = &tokens[idx] {
                            cur = if is_rel { Point2D { x: cur.x + x, y: cur.y } } else { Point2D { x: *x, y: cur.y } };
                            raw_vertices.push(cur);
                            idx += 1;
                        }
                    }
                }
                'V' | 'v' => {
                    let is_rel = cmd == 'v';
                    if idx < tokens.len() {
                        if let SvgToken::Num(y) = &tokens[idx] {
                            cur = if is_rel { Point2D { x: cur.x, y: cur.y + y } } else { Point2D { x: cur.x, y: *y } };
                            raw_vertices.push(cur);
                            idx += 1;
                        }
                    }
                }
                'C' | 'c' => {
                    let is_rel = cmd == 'c';
                    while idx + 5 < tokens.len() {
                        if let (
                            SvgToken::Num(x1), SvgToken::Num(y1),
                            SvgToken::Num(x2), SvgToken::Num(y2),
                            SvgToken::Num(x), SvgToken::Num(y),
                        ) = (
                            &tokens[idx], &tokens[idx + 1],
                            &tokens[idx + 2], &tokens[idx + 3],
                            &tokens[idx + 4], &tokens[idx + 5],
                        ) {
                            let p1 = if is_rel { Point2D { x: cur.x + x1, y: cur.y + y1 } } else { Point2D { x: *x1, y: *y1 } };
                            let p2 = if is_rel { Point2D { x: cur.x + x2, y: cur.y + y2 } } else { Point2D { x: *x2, y: *y2 } };
                            let p3 = if is_rel { Point2D { x: cur.x + x, y: cur.y + y } } else { Point2D { x: *x, y: *y } };
                            for s in 1..=16 {
                                let t = s as f64 / 16.0;
                                raw_vertices.push(sample_cubic_bezier(cur, p1, p2, p3, t));
                            }
                            cur = p3;
                            idx += 6;
                        } else {
                            break;
                        }
                    }
                }
                'Q' | 'q' => {
                    let is_rel = cmd == 'q';
                    while idx + 3 < tokens.len() {
                        if let (
                            SvgToken::Num(x1), SvgToken::Num(y1),
                            SvgToken::Num(x), SvgToken::Num(y),
                        ) = (
                            &tokens[idx], &tokens[idx + 1],
                            &tokens[idx + 2], &tokens[idx + 3],
                        ) {
                            let p1 = if is_rel { Point2D { x: cur.x + x1, y: cur.y + y1 } } else { Point2D { x: *x1, y: *y1 } };
                            let p2 = if is_rel { Point2D { x: cur.x + x, y: cur.y + y } } else { Point2D { x: *x, y: *y } };
                            for s in 1..=8 {
                                let t = s as f64 / 8.0;
                                raw_vertices.push(sample_quadratic_bezier(cur, p1, p2, t));
                            }
                            cur = p2;
                            idx += 4;
                        } else {
                            break;
                        }
                    }
                }
                'Z' | 'z' => {
                    raw_vertices.push(start);
                    cur = start;
                }
                _ => {}
            }
        } else {
            idx += 1;
        }
    }

    if raw_vertices.len() < 3 {
        let mut full = ImageBuffer::new(w, h);
        for p in full.pixels_mut() {
            *p = Luma([255]);
        }
        return full;
    }

    // Normalize and scale vertices to bounding box (w, h)
    let min_x = raw_vertices.iter().map(|p| p.x).fold(f64::INFINITY, f64::min);
    let max_x = raw_vertices.iter().map(|p| p.x).fold(f64::NEG_INFINITY, f64::max);
    let min_y = raw_vertices.iter().map(|p| p.y).fold(f64::INFINITY, f64::min);
    let max_y = raw_vertices.iter().map(|p| p.y).fold(f64::NEG_INFINITY, f64::max);

    let span_x = (max_x - min_x).max(1e-6);
    let span_y = (max_y - min_y).max(1e-6);

    let scaled: Vec<Point2D> = raw_vertices.into_iter().map(|p| {
        Point2D {
            x: ((p.x - min_x) / span_x) * w as f64,
            y: ((p.y - min_y) / span_y) * h as f64,
        }
    }).collect();

    rasterize_polygon_mask(w, h, &scaled)
}

/// Unified dispatcher to generate a non-destructive grayscale shape mask (Channel ID -2).
pub fn generate_shape_mask(
    shape_type: Option<&str>,
    custom_svg: Option<&str>,
    radii: (f64, f64, f64, f64),
    w: u32,
    h: u32,
) -> Option<ImageBuffer<Luma<u8>, Vec<u8>>> {
    if w == 0 || h == 0 {
        return None;
    }

    let has_radii = radii.0 > 0.5 || radii.1 > 0.5 || radii.2 > 0.5 || radii.3 > 0.5;
    let shape = shape_type.unwrap_or("rectangle");

    match shape {
        "circle" => Some(generate_circle_mask(w, h)),
        "oval" => Some(generate_oval_mask(w, h)),
        "hexagon" => Some(generate_polygon_mask(6, w, h)),
        "octagon" => Some(generate_polygon_mask(8, w, h)),
        "star" => Some(generate_star_mask(5, 0.45, w, h)),
        "scallop" => Some(generate_scallop_mask(10, w, h)),
        "heart" => Some(generate_heart_mask(w, h)),
        "custom_svg" => {
            if let Some(svg) = custom_svg {
                if !svg.trim().is_empty() {
                    return Some(generate_custom_svg_mask(svg, w, h));
                }
            }
            if has_radii {
                Some(generate_rounded_rect_mask(w, h, radii.0, radii.1, radii.2, radii.3))
            } else {
                None
            }
        }
        "rounded" => Some(generate_rounded_rect_mask(w, h, radii.0, radii.1, radii.2, radii.3)),
        "rectangle" => {
            if has_radii {
                Some(generate_rounded_rect_mask(w, h, radii.0, radii.1, radii.2, radii.3))
            } else {
                None
            }
        }
        _ => {
            if has_radii {
                Some(generate_rounded_rect_mask(w, h, radii.0, radii.1, radii.2, radii.3))
            } else {
                None
            }
        }
    }
}

// ============================================================================
// Photoshop Layer & 5-Section Document Serializer
// ============================================================================

pub struct PsdLayer {
    pub name: String,
    pub top: i32,
    pub left: i32,
    pub bottom: i32,
    pub right: i32,
    pub opacity: u8,
    pub image: RgbaImage,
    pub mask: Option<ImageBuffer<Luma<u8>, Vec<u8>>>,
}

impl PsdLayer {
    pub fn new(
        name: impl Into<String>,
        top: i32,
        left: i32,
        bottom: i32,
        right: i32,
        image: RgbaImage,
        mask: Option<ImageBuffer<Luma<u8>, Vec<u8>>>,
    ) -> Self {
        Self {
            name: name.into(),
            top,
            left,
            bottom,
            right,
            opacity: 255,
            image,
            mask,
        }
    }

    pub fn with_opacity(mut self, opacity: u8) -> Self {
        self.opacity = opacity;
        self
    }
}

struct PreparedChannel {
    channel_id: i16,
    row_lengths: Vec<u16>,
    compressed_bytes: Vec<u8>,
}

impl PreparedChannel {
    fn total_channel_data_len(&self) -> u32 {
        // 2 bytes compression + (scanlines * 2) + compressed byte payload
        2 + (self.row_lengths.len() as u32 * 2) + self.compressed_bytes.len() as u32
    }
}

/// Pure Rust 5-section Adobe Photoshop document (.psd) serializer.
pub fn write_psd_to_writer<W: Write>(
    w: &mut W,
    width: u32,
    height: u32,
    dpi: u32,
    layers: &[PsdLayer],
    composite: &RgbaImage,
) -> Result<(), String> {
    if width == 0 || height == 0 {
        return Err("PSD document dimensions must be greater than 0".to_string());
    }

    // ------------------------------------------------------------------------
    // Section 1: File Header (26 bytes)
    // ------------------------------------------------------------------------
    w.write_all(b"8BPS").map_err(|e| e.to_string())?; // Signature
    w.write_all(&1u16.to_be_bytes()).map_err(|e| e.to_string())?; // Version 1
    w.write_all(&[0u8; 6]).map_err(|e| e.to_string())?; // 6 reserved bytes
    w.write_all(&3u16.to_be_bytes()).map_err(|e| e.to_string())?; // 3 channels (RGB)
    w.write_all(&height.to_be_bytes()).map_err(|e| e.to_string())?;
    w.write_all(&width.to_be_bytes()).map_err(|e| e.to_string())?;
    w.write_all(&8u16.to_be_bytes()).map_err(|e| e.to_string())?; // 8 bits per channel
    w.write_all(&3u16.to_be_bytes()).map_err(|e| e.to_string())?; // ColorMode = 3 (RGB)

    // ------------------------------------------------------------------------
    // Section 2: Color Mode Data (4 bytes: length = 0 for RGB)
    // ------------------------------------------------------------------------
    w.write_all(&0u32.to_be_bytes()).map_err(|e| e.to_string())?;

    // ------------------------------------------------------------------------
    // Section 3: Image Resources (ResolutionInfo 0x03ED)
    // ------------------------------------------------------------------------
    // Resource block:
    // '8BIM' (4), 0x03ED (2), Pascal string padded (2), Size 16 (4), 16 bytes data = 28 bytes
    let mut res_buf = Vec::with_capacity(32);
    res_buf.extend_from_slice(b"8BIM");
    res_buf.extend_from_slice(&0x03EDu16.to_be_bytes()); // ResolutionInfo
    res_buf.extend_from_slice(&[0x00, 0x00]); // Name: length 0 + 1 pad byte
    res_buf.extend_from_slice(&16u32.to_be_bytes()); // Size of resource data

    let safe_dpi = dpi.clamp(72, 2400);
    let fixed_dpi = safe_dpi << 16;
    res_buf.extend_from_slice(&fixed_dpi.to_be_bytes()); // hRes (fixed-point 16.16)
    res_buf.extend_from_slice(&1u16.to_be_bytes()); // hResUnit = 1 (pixels/inch)
    res_buf.extend_from_slice(&1u16.to_be_bytes()); // widthUnit = 1 (inches)
    res_buf.extend_from_slice(&fixed_dpi.to_be_bytes()); // vRes
    res_buf.extend_from_slice(&1u16.to_be_bytes()); // vResUnit = 1 (pixels/inch)
    res_buf.extend_from_slice(&1u16.to_be_bytes()); // heightUnit = 1 (inches)

    w.write_all(&(res_buf.len() as u32).to_be_bytes()).map_err(|e| e.to_string())?;
    w.write_all(&res_buf).map_err(|e| e.to_string())?;

    // ------------------------------------------------------------------------
    // Section 4: Layer and Mask Information Section
    // ------------------------------------------------------------------------
    let mut prepared_layers: Vec<Vec<PreparedChannel>> = Vec::with_capacity(layers.len());

    for layer in layers {
        let layer_w = (layer.right - layer.left).max(0) as usize;
        let layer_h = (layer.bottom - layer.top).max(0) as usize;

        let mut channels = Vec::new();

        // 4 standard channels: Red(0), Green(1), Blue(2), Alpha(-1)
        for (ch_idx, ch_id) in [(0usize, 0i16), (1, 1), (2, 2), (3, -1)] {
            let mut row_lengths = Vec::with_capacity(layer_h);
            let mut comp_bytes = Vec::new();

            for y in 0..layer_h {
                let mut row = vec![0u8; layer_w];
                for x in 0..layer_w {
                    if x < layer.image.width() as usize && y < layer.image.height() as usize {
                        row[x] = layer.image.get_pixel(x as u32, y as u32)[ch_idx];
                    }
                }
                let enc = packbits_encode_row(&row);
                row_lengths.push(enc.len() as u16);
                comp_bytes.extend_from_slice(&enc);
            }

            channels.push(PreparedChannel {
                channel_id: ch_id,
                row_lengths,
                compressed_bytes: comp_bytes,
            });
        }

        // Optional User Layer Mask (Channel -2)
        if let Some(ref mask) = layer.mask {
            let mut row_lengths = Vec::with_capacity(layer_h);
            let mut comp_bytes = Vec::new();

            for y in 0..layer_h {
                let mut row = vec![0u8; layer_w];
                for x in 0..layer_w {
                    if x < mask.width() as usize && y < mask.height() as usize {
                        row[x] = mask.get_pixel(x as u32, y as u32)[0];
                    }
                }
                let enc = packbits_encode_row(&row);
                row_lengths.push(enc.len() as u16);
                comp_bytes.extend_from_slice(&enc);
            }

            channels.push(PreparedChannel {
                channel_id: -2,
                row_lengths,
                compressed_bytes: comp_bytes,
            });
        }

        prepared_layers.push(channels);
    }

    // Build Layer Records
    let mut layer_records_bytes = Vec::new();
    for (i, layer) in layers.iter().enumerate() {
        let channels = &prepared_layers[i];

        // Bounds: top, left, bottom, right (4 * i32)
        layer_records_bytes.extend_from_slice(&layer.top.to_be_bytes());
        layer_records_bytes.extend_from_slice(&layer.left.to_be_bytes());
        layer_records_bytes.extend_from_slice(&layer.bottom.to_be_bytes());
        layer_records_bytes.extend_from_slice(&layer.right.to_be_bytes());

        // Channel count
        layer_records_bytes.extend_from_slice(&(channels.len() as u16).to_be_bytes());

        // Channel info records
        for ch in channels {
            layer_records_bytes.extend_from_slice(&ch.channel_id.to_be_bytes());
            layer_records_bytes.extend_from_slice(&ch.total_channel_data_len().to_be_bytes());
        }

        // Blend mode signature & key
        layer_records_bytes.extend_from_slice(b"8BIM");
        layer_records_bytes.extend_from_slice(b"norm");

        // Opacity, clipping, flags, filler
        layer_records_bytes.push(layer.opacity);
        layer_records_bytes.push(0u8); // Clipping: base
        layer_records_bytes.push(0x08u8); // Flags: bit 3 = 1
        layer_records_bytes.push(0u8); // Filler

        // Extra data block
        let mut extra_data = Vec::new();

        // 1. Layer Mask Data
        if layer.mask.is_some() {
            extra_data.extend_from_slice(&20u32.to_be_bytes()); // size = 20
            extra_data.extend_from_slice(&layer.top.to_be_bytes());
            extra_data.extend_from_slice(&layer.left.to_be_bytes());
            extra_data.extend_from_slice(&layer.bottom.to_be_bytes());
            extra_data.extend_from_slice(&layer.right.to_be_bytes());
            extra_data.push(0u8); // default color (black outside)
            extra_data.push(0u8); // flags (absolute canvas coords)
            extra_data.extend_from_slice(&[0u8, 0u8]); // padding
        } else {
            extra_data.extend_from_slice(&0u32.to_be_bytes()); // size = 0
        }

        // 2. Layer Blending Ranges (empty)
        extra_data.extend_from_slice(&0u32.to_be_bytes());

        // 3. Layer Name (Pascal string padded to 4-byte multiple)
        let name_bytes = layer.name.as_bytes();
        let name_len = name_bytes.len().min(255) as u8;
        extra_data.push(name_len);
        extra_data.extend_from_slice(&name_bytes[0..name_len as usize]);
        let total_name_len = 1 + name_len as usize;
        let pad_len = (4 - (total_name_len % 4)) % 4;
        for _ in 0..pad_len {
            extra_data.push(0u8);
        }

        // Write extra data length + extra data payload
        layer_records_bytes.extend_from_slice(&(extra_data.len() as u32).to_be_bytes());
        layer_records_bytes.extend_from_slice(&extra_data);
    }

    // Build Channel Image Data (concatenated in identical order)
    let mut channel_image_data = Vec::new();
    for channels in &prepared_layers {
        for ch in channels {
            // Compression header: 1 = RLE PackBits
            channel_image_data.extend_from_slice(&1u16.to_be_bytes());
            for &len in &ch.row_lengths {
                channel_image_data.extend_from_slice(&len.to_be_bytes());
            }
            channel_image_data.extend_from_slice(&ch.compressed_bytes);
        }
    }

    // Layer Info Section
    // 2 bytes count + records + channel data
    let mut layer_info_payload = Vec::new();
    layer_info_payload.extend_from_slice(&(layers.len() as i16).to_be_bytes());
    layer_info_payload.extend_from_slice(&layer_records_bytes);
    layer_info_payload.extend_from_slice(&channel_image_data);

    // Round layer info to an even byte count per Adobe specification
    if layer_info_payload.len() % 2 != 0 {
        layer_info_payload.push(0u8);
    }

    // Section 4 Total Payload:
    // 4 bytes layer info len + layer info payload + 4 bytes global mask len (0)
    let mut section_4_payload = Vec::new();
    section_4_payload.extend_from_slice(&(layer_info_payload.len() as u32).to_be_bytes());
    section_4_payload.extend_from_slice(&layer_info_payload);
    section_4_payload.extend_from_slice(&0u32.to_be_bytes()); // Global layer mask length = 0

    // Round Section 4 to even length if necessary
    if section_4_payload.len() % 2 != 0 {
        section_4_payload.push(0u8);
    }

    w.write_all(&(section_4_payload.len() as u32).to_be_bytes()).map_err(|e| e.to_string())?;
    w.write_all(&section_4_payload).map_err(|e| e.to_string())?;

    // ------------------------------------------------------------------------
    // Section 5: Merged Composite Image (Planar RGB with PackBits RLE)
    // ------------------------------------------------------------------------
    let comp_w = width as usize;
    let comp_h = height as usize;

    let mut r_row_lengths = Vec::with_capacity(comp_h);
    let mut g_row_lengths = Vec::with_capacity(comp_h);
    let mut b_row_lengths = Vec::with_capacity(comp_h);

    let mut r_comp_data = Vec::new();
    let mut g_comp_data = Vec::new();
    let mut b_comp_data = Vec::new();

    for y in 0..comp_h {
        let mut r_row = vec![0u8; comp_w];
        let mut g_row = vec![0u8; comp_w];
        let mut b_row = vec![0u8; comp_w];

        for x in 0..comp_w {
            let p = if x < composite.width() as usize && y < composite.height() as usize {
                composite.get_pixel(x as u32, y as u32)
            } else {
                &Rgba([255, 255, 255, 255])
            };
            r_row[x] = p[0];
            g_row[x] = p[1];
            b_row[x] = p[2];
        }

        let r_enc = packbits_encode_row(&r_row);
        r_row_lengths.push(r_enc.len() as u16);
        r_comp_data.extend_from_slice(&r_enc);

        let g_enc = packbits_encode_row(&g_row);
        g_row_lengths.push(g_enc.len() as u16);
        g_comp_data.extend_from_slice(&g_enc);

        let b_enc = packbits_encode_row(&b_row);
        b_row_lengths.push(b_enc.len() as u16);
        b_comp_data.extend_from_slice(&b_enc);
    }

    // Compression: 1 = RLE PackBits
    w.write_all(&1u16.to_be_bytes()).map_err(|e| e.to_string())?;

    // Write all scanline byte counts: R rows, G rows, B rows
    for len in &r_row_lengths {
        w.write_all(&len.to_be_bytes()).map_err(|e| e.to_string())?;
    }
    for len in &g_row_lengths {
        w.write_all(&len.to_be_bytes()).map_err(|e| e.to_string())?;
    }
    for len in &b_row_lengths {
        w.write_all(&len.to_be_bytes()).map_err(|e| e.to_string())?;
    }

    // Write compressed pixel streams
    w.write_all(&r_comp_data).map_err(|e| e.to_string())?;
    w.write_all(&g_comp_data).map_err(|e| e.to_string())?;
    w.write_all(&b_comp_data).map_err(|e| e.to_string())?;

    Ok(())
}

/// Convenience file writer for PSD documents.
pub fn write_psd_file(
    path: &Path,
    width: u32,
    height: u32,
    dpi: u32,
    layers: &[PsdLayer],
    composite: &RgbaImage,
) -> Result<(), String> {
    let file = File::create(path).map_err(|e| format!("Failed to create PSD file {}: {}", path.display(), e))?;
    let mut writer = BufWriter::new(file);
    write_psd_to_writer(&mut writer, width, height, dpi, layers, composite)?;
    writer.flush().map_err(|e| format!("Failed to flush PSD file {}: {}", path.display(), e))?;
    Ok(())
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_packbits_roundtrip_various_patterns() {
        let test_cases: Vec<Vec<u8>> = vec![
            vec![],
            vec![42],
            vec![1, 2, 3, 4, 5],
            vec![7, 7, 7, 7, 7, 7, 7],
            vec![10; 128],
            vec![10; 130],
            vec![1, 1, 2, 3, 3, 3, 4, 5, 5, 5, 5, 6],
            (0..255).collect(),
        ];

        for src in test_cases {
            let compressed = packbits_encode_row(&src);
            let decompressed = packbits_decode_row(&compressed, src.len()).expect("Decode should succeed");
            assert_eq!(decompressed, src, "Decompressed must match source for len {}", src.len());
        }
    }

    #[test]
    fn test_psd_binary_serializer_header_and_resources() {
        let width = 300;
        let height = 200;
        let dpi = 300;

        let composite = RgbaImage::new(width, height);
        let photo = RgbaImage::new(100, 100);
        let mask = generate_circle_mask(100, 100);

        let layers = vec![
            PsdLayer::new("Background", 0, 0, height as i32, width as i32, RgbaImage::new(width, height), None),
            PsdLayer::new("Photo 1", 50, 50, 150, 150, photo, Some(mask)),
        ];

        let mut buffer = Vec::new();
        write_psd_to_writer(&mut buffer, width, height, dpi, &layers, &composite)
            .expect("PSD write must succeed");

        assert!(buffer.len() > 100);

        // Verify Section 1 Header
        assert_eq!(&buffer[0..4], b"8BPS");
        assert_eq!(u16::from_be_bytes([buffer[4], buffer[5]]), 1); // version
        assert_eq!(u16::from_be_bytes([buffer[12], buffer[13]]), 3); // channels
        assert_eq!(u32::from_be_bytes([buffer[14], buffer[15], buffer[16], buffer[17]]), height);
        assert_eq!(u32::from_be_bytes([buffer[18], buffer[19], buffer[20], buffer[21]]), width);
        assert_eq!(u16::from_be_bytes([buffer[22], buffer[23]]), 8); // depth
        assert_eq!(u16::from_be_bytes([buffer[24], buffer[25]]), 3); // RGB mode

        // Verify Section 2 Color Mode
        assert_eq!(u32::from_be_bytes([buffer[26], buffer[27], buffer[28], buffer[29]]), 0);

        // Verify Section 3 ResolutionInfo Block
        let res_len = u32::from_be_bytes([buffer[30], buffer[31], buffer[32], buffer[33]]);
        assert_eq!(res_len, 28);
        assert_eq!(&buffer[34..38], b"8BIM");
        assert_eq!(u16::from_be_bytes([buffer[38], buffer[39]]), 0x03ED);
    }

    #[test]
    fn test_shape_mask_circle_and_polygon_generation() {
        let circle_mask = generate_circle_mask(100, 100);
        assert_eq!(circle_mask.width(), 100);
        assert_eq!(circle_mask.height(), 100);
        // Center pixel should be opaque 255
        assert_eq!(circle_mask.get_pixel(50, 50)[0], 255);
        // Far corner should be outside 0
        assert_eq!(circle_mask.get_pixel(0, 0)[0], 0);

        let hex_mask = generate_polygon_mask(6, 100, 100);
        assert_eq!(hex_mask.get_pixel(50, 50)[0], 255);
        assert_eq!(hex_mask.get_pixel(0, 0)[0], 0);
    }
}
