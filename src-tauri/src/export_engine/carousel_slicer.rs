use std::fs;
use std::path::Path;
use image::{ImageBuffer, RgbaImage};
use serde::{Deserialize, Serialize};

use super::{compute_rect_border_alpha, encode_jpeg_with_dpi, parse_hex_color};
use super::psd_writer::{compute_corner_alpha, generate_shape_mask};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CarouselPayload {
    pub project_id: String,
    pub project_name: String,
    pub ratio: String,
    pub slide_width_px: u32,
    pub slide_height_px: u32,
    pub total_slides: usize,
    pub slides: Vec<CarouselSlidePayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CarouselSlidePayload {
    pub id: String,
    pub slide_index: usize,
    pub background_color: String,
    pub elements: Vec<CarouselElementPayload>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CarouselElementPayload {
    pub id: String,
    pub file_path: Option<String>,
    pub preview_path: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub hidden: Option<bool>,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub crop_x: Option<f64>,
    pub crop_y: Option<f64>,
    pub crop_scale: Option<f64>,
    pub rotation: Option<f64>,
    pub corner_radius: Option<f64>,
    pub corner_radius_tl: Option<f64>,
    pub corner_radius_tr: Option<f64>,
    pub corner_radius_br: Option<f64>,
    pub corner_radius_bl: Option<f64>,
    pub shape_type: Option<String>,
    pub custom_svg_path: Option<String>,
    #[serde(default)]
    pub border_enabled: Option<bool>,
    #[serde(default)]
    pub border_width: Option<f64>,
    pub border_color: Option<String>,
    pub border_style: Option<String>,
    #[serde(default)]
    pub opacity: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CarouselExportOptions {
    pub output_dir: String,
    #[serde(default = "default_carousel_jpeg_quality")]
    pub jpeg_quality: u8,
    #[serde(default = "default_true")]
    pub export_panorama: bool,
    pub file_prefix: Option<String>,
}

fn default_carousel_jpeg_quality() -> u8 {
    92
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CarouselExportResult {
    pub output_folder: String,
    pub slide_files: Vec<String>,
    pub panorama_file: Option<String>,
    pub total_slides: usize,
}

/// Converts seconds since UNIX epoch to Gregorian calendar timestamp string `YYYYMMDD_HHMMSS`.
pub fn format_timestamp(secs: u64) -> String {
    let days = (secs / 86400) as i64;
    let time_secs = (secs % 86400) as u32;
    let hour = time_secs / 3600;
    let minute = (time_secs % 3600) / 60;
    let second = time_secs % 60;

    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };

    format!("{:04}{:02}{:02}_{:02}{:02}{:02}", y, m, d, hour, minute, second)
}

/// Renders the continuous panoramic stage for a carousel project.
///
/// Multi-slide canvas of size (total_slides * slide_width_px, slide_height_px).
/// Elements spanning slide boundaries render seamlessly across the stage.
pub fn render_carousel_panorama(payload: &CarouselPayload) -> RgbaImage {
    let total_slides = payload.total_slides.max(1);
    let slide_w = payload.slide_width_px.max(100);
    let slide_h = payload.slide_height_px.max(100);
    let total_w = (total_slides as u32) * slide_w;

    let mut canvas: RgbaImage = ImageBuffer::new(total_w, slide_h);

    // 1. Fill slide backgrounds
    for (i, slide) in payload.slides.iter().enumerate() {
        let start_x = (i as u32) * slide_w;
        let end_x = ((i as u32 + 1) * slide_w).min(total_w);
        let bg = parse_hex_color(&slide.background_color);
        for y in 0..slide_h {
            for x in start_x..end_x {
                canvas.put_pixel(x, y, bg);
            }
        }
    }

    // 2. Collect and composite all elements across slides
    let mut all_elements: Vec<&CarouselElementPayload> = Vec::new();
    for slide in &payload.slides {
        for elem in &slide.elements {
            all_elements.push(elem);
        }
    }

    for elem in all_elements {
        if elem.hidden.unwrap_or(false) {
            continue;
        }
        let Some(ref raw_path) = elem.file_path else {
            continue;
        };
        if raw_path.trim().is_empty() {
            continue;
        }

        let target_w = elem.width.round().max(1.0) as u32;
        let target_h = elem.height.round().max(1.0) as u32;

        let photo_img = super::crop_and_rotate_photo(
            raw_path,
            elem.preview_path.as_deref(),
            elem.width,
            elem.height,
            elem.rotation.unwrap_or(0.0),
            elem.crop_x.unwrap_or(0.0),
            elem.crop_y.unwrap_or(0.0),
            elem.crop_scale.unwrap_or(1.0),
            None,
            target_w,
            target_h,
        );

        let Some(rendered_photo) = photo_img else {
            continue;
        };

        let r_tl = elem.corner_radius_tl.or(elem.corner_radius).unwrap_or(0.0).max(0.0);
        let r_tr = elem.corner_radius_tr.or(elem.corner_radius).unwrap_or(0.0).max(0.0);
        let r_br = elem.corner_radius_br.or(elem.corner_radius).unwrap_or(0.0).max(0.0);
        let r_bl = elem.corner_radius_bl.or(elem.corner_radius).unwrap_or(0.0).max(0.0);
        let has_corner_radius = r_tl > 0.5 || r_tr > 0.5 || r_br > 0.5 || r_bl > 0.5;

        let border_enabled = elem.border_enabled.unwrap_or(false);
        let border_width = elem.border_width.unwrap_or(0.0);
        let has_border = border_enabled && border_width > 0.0;
        let border_px = if has_border { border_width } else { 0.0 };
        let border_color_str = elem.border_color.as_deref().unwrap_or("#FFFFFF");
        let border_color = parse_hex_color(border_color_str);
        let elem_opacity = elem.opacity.unwrap_or(1.0).clamp(0.0, 1.0);
        let frame_w_f = target_w as f64;
        let frame_h_f = target_h as f64;
        let inner_w = (frame_w_f - 2.0 * border_px).max(0.0);
        let inner_h = (frame_h_f - 2.0 * border_px).max(0.0);
        let inner_r_tl = (r_tl - border_px).max(0.0);
        let inner_r_tr = (r_tr - border_px).max(0.0);
        let inner_r_br = (r_br - border_px).max(0.0);
        let inner_r_bl = (r_bl - border_px).max(0.0);

        let shape = elem.shape_type.as_deref();
        let custom_svg = elem.custom_svg_path.as_deref();
        let shape_mask = generate_shape_mask(shape, custom_svg, (r_tl, r_tr, r_br, r_bl), target_w, target_h);

        // Composite onto master continuous canvas
        let dest_base_x = elem.x.round() as i64;
        let dest_base_y = elem.y.round() as i64;
        let canvas_w_i64 = total_w as i64;
        let canvas_h_i64 = slide_h as i64;

        for fy in 0..target_h {
            let dy = dest_base_y + fy as i64;
            if dy < 0 || dy >= canvas_h_i64 {
                continue;
            }

            for fx in 0..target_w {
                let dx = dest_base_x + fx as i64;
                if dx < 0 || dx >= canvas_w_i64 {
                    continue;
                }

                let shape_alpha = if let Some(ref m) = shape_mask {
                    m.get_pixel(fx, fy)[0] as f64 / 255.0
                } else {
                    1.0
                };

                let corner_alpha = if has_corner_radius {
                    compute_corner_alpha(
                        fx as f64 + 0.5,
                        fy as f64 + 0.5,
                        frame_w_f,
                        frame_h_f,
                        r_tl,
                        r_tr,
                        r_br,
                        r_bl,
                    )
                } else {
                    1.0
                };

                if corner_alpha < 0.001 || shape_alpha < 0.001 {
                    continue;
                }

                let border_alpha = if !has_border || border_px <= 0.0 {
                    0.0
                } else if !has_corner_radius {
                    compute_rect_border_alpha(fx as f64 + 0.5, fy as f64 + 0.5, frame_w_f, frame_h_f, border_px)
                } else {
                    let px_center_x = fx as f64 + 0.5;
                    let px_center_y = fy as f64 + 0.5;
                    if border_px < 1.0 {
                        let outer_alpha = corner_alpha;
                        if outer_alpha > 0.0 {
                            let dist_to_edge = (px_center_x.min(frame_w_f - px_center_x)).min(px_center_y.min(frame_h_f - px_center_y));
                            if dist_to_edge < 1.0 {
                                (border_px * outer_alpha).clamp(0.0, 1.0)
                            } else {
                                0.0
                            }
                        } else {
                            0.0
                        }
                    } else {
                        let inner_alpha = if inner_w > 0.0 && inner_h > 0.0
                            && px_center_x >= border_px && px_center_x < frame_w_f - border_px
                            && px_center_y >= border_px && px_center_y < frame_h_f - border_px {
                            compute_corner_alpha(
                                px_center_x - border_px, px_center_y - border_px,
                                inner_w, inner_h, inner_r_tl, inner_r_tr, inner_r_br, inner_r_bl,
                            )
                        } else {
                            0.0
                        };
                        (corner_alpha - inner_alpha).clamp(0.0, 1.0)
                    }
                };

                let p = rendered_photo.get_pixel(fx, fy);
                let photo_alpha = p[3] as f64 / 255.0 * corner_alpha * shape_alpha;
                let source_alpha = border_alpha + photo_alpha * (1.0 - border_alpha);
                let effective_alpha = (source_alpha * elem_opacity).clamp(0.0, 1.0);
                if effective_alpha < 0.001 {
                    continue;
                }

                let source_color = if border_alpha > 0.0 {
                    let photo_weight = photo_alpha * (1.0 - border_alpha);
                    [
                        ((border_color[0] as f64 * border_alpha + p[0] as f64 * photo_weight) / source_alpha).round() as u8,
                        ((border_color[1] as f64 * border_alpha + p[1] as f64 * photo_weight) / source_alpha).round() as u8,
                        ((border_color[2] as f64 * border_alpha + p[2] as f64 * photo_weight) / source_alpha).round() as u8,
                    ]
                } else {
                    [p[0], p[1], p[2]]
                };

                if effective_alpha > 0.999 {
                    canvas.put_pixel(dx as u32, dy as u32, image::Rgba([
                        source_color[0], source_color[1], source_color[2], 255,
                    ]));
                } else {
                    let dst = canvas.get_pixel_mut(dx as u32, dy as u32);
                    let inv = 1.0 - effective_alpha;
                    dst[0] = ((source_color[0] as f64 * effective_alpha) + (dst[0] as f64 * inv)).round() as u8;
                    dst[1] = ((source_color[1] as f64 * effective_alpha) + (dst[1] as f64 * inv)).round() as u8;
                    dst[2] = ((source_color[2] as f64 * effective_alpha) + (dst[2] as f64 * inv)).round() as u8;
                    dst[3] = 255;
                }
            }
        }
    }

    canvas
}

/// Executes the Instagram multi-slide carousel slice export pipeline.
pub fn export_carousel_slices_worker(
    payload: &CarouselPayload,
    options: &CarouselExportOptions,
) -> Result<CarouselExportResult, String> {
    let total_slides = payload.total_slides.max(1);
    let slide_w = payload.slide_width_px.max(100);
    let slide_h = payload.slide_height_px.max(100);

    let canvas = render_carousel_panorama(payload);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let timestamp_str = format_timestamp(now);

    let base_name = options.file_prefix.as_deref().unwrap_or(&payload.project_name);
    let clean_name = if !base_name.trim().is_empty() {
        base_name.trim().replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_")
    } else {
        "Carousel".to_string()
    };

    let folder_name = format!("{}_Carousel_{}", clean_name, timestamp_str);
    let out_dir = Path::new(&options.output_dir).join(folder_name);
    fs::create_dir_all(&out_dir)
        .map_err(|e| format!("Failed to create carousel output folder {}: {}", out_dir.display(), e))?;

    let mut slide_files = Vec::with_capacity(total_slides);

    // Slicing into individual slide JPEGs
    for i in 0..total_slides {
        let slice_x = (i as u32) * slide_w;
        let sub = image::imageops::crop_imm(&canvas, slice_x, 0, slide_w, slide_h).to_image();
        let rgb = image::DynamicImage::ImageRgba8(sub).to_rgb8();

        let filename = format!("slide_{:02}.jpg", i + 1);
        let slice_dest = out_dir.join(&filename);

        let jpeg_bytes = encode_jpeg_with_dpi(&rgb, options.jpeg_quality, 72)?;
        fs::write(&slice_dest, &jpeg_bytes)
            .map_err(|e| format!("Failed to write slide {}: {}", slice_dest.display(), e))?;

        slide_files.push(slice_dest.to_string_lossy().to_string());
    }

    // Optional full stitched panorama
    let panorama_file = if options.export_panorama {
        let pano_rgb = image::DynamicImage::ImageRgba8(canvas).to_rgb8();
        let pano_dest = out_dir.join("full_panorama.jpg");
        let pano_bytes = encode_jpeg_with_dpi(&pano_rgb, options.jpeg_quality, 72)?;
        fs::write(&pano_dest, &pano_bytes)
            .map_err(|e| format!("Failed to write panorama {}: {}", pano_dest.display(), e))?;
        Some(pano_dest.to_string_lossy().to_string())
    } else {
        None
    };

    Ok(CarouselExportResult {
        output_folder: out_dir.to_string_lossy().to_string(),
        slide_files,
        panorama_file,
        total_slides,
    })
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    #[test]
    fn test_format_timestamp_known_epoch() {
        // 2026-09-22 00:00:00 UTC = 1790035200
        let formatted = format_timestamp(1790035200);
        assert_eq!(formatted, "20260922_000000");
    }

    #[test]
    fn test_render_carousel_panorama_dimensions() {
        let payload = CarouselPayload {
            project_id: "test-proj".to_string(),
            project_name: "My Trip".to_string(),
            ratio: "4:5".to_string(),
            slide_width_px: 1080,
            slide_height_px: 1350,
            total_slides: 3,
            slides: vec![
                CarouselSlidePayload {
                    id: "s1".to_string(),
                    slide_index: 0,
                    background_color: "#FF0000".to_string(),
                    elements: vec![],
                },
                CarouselSlidePayload {
                    id: "s2".to_string(),
                    slide_index: 1,
                    background_color: "#00FF00".to_string(),
                    elements: vec![],
                },
                CarouselSlidePayload {
                    id: "s3".to_string(),
                    slide_index: 2,
                    background_color: "#0000FF".to_string(),
                    elements: vec![],
                },
            ],
        };

        let pano = render_carousel_panorama(&payload);
        assert_eq!(pano.width(), 3240); // 3 * 1080
        assert_eq!(pano.height(), 1350);

        // Verify slide 1 color (Red)
        assert_eq!(pano.get_pixel(100, 100), &Rgba([255, 0, 0, 255]));
        // Verify slide 2 color (Green)
        assert_eq!(pano.get_pixel(1200, 100), &Rgba([0, 255, 0, 255]));
        // Verify slide 3 color (Blue)
        assert_eq!(pano.get_pixel(2500, 100), &Rgba([0, 0, 255, 255]));
    }

    #[test]
    fn test_export_carousel_slices_worker_generates_files() {
        let temp_dir = std::env::temp_dir().join(format!("carousel_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();

        let payload = CarouselPayload {
            project_id: "test-carousel".to_string(),
            project_name: "Summer Vibes".to_string(),
            ratio: "1:1".to_string(),
            slide_width_px: 200,
            slide_height_px: 200,
            total_slides: 2,
            slides: vec![
                CarouselSlidePayload {
                    id: "s1".to_string(),
                    slide_index: 0,
                    background_color: "#FFFFFF".to_string(),
                    elements: vec![],
                },
                CarouselSlidePayload {
                    id: "s2".to_string(),
                    slide_index: 1,
                    background_color: "#EEEEEE".to_string(),
                    elements: vec![],
                },
            ],
        };

        let options = CarouselExportOptions {
            output_dir: temp_dir.to_string_lossy().to_string(),
            jpeg_quality: 90,
            export_panorama: true,
            file_prefix: Some("TestExport".to_string()),
        };

        let result = export_carousel_slices_worker(&payload, &options).expect("Worker should succeed");
        assert_eq!(result.total_slides, 2);
        assert_eq!(result.slide_files.len(), 2);
        assert!(result.panorama_file.is_some());

        for path in &result.slide_files {
            assert!(Path::new(path).exists());
            let img = image::open(path).expect("Slice image must be openable");
            assert_eq!(img.width(), 200);
            assert_eq!(img.height(), 200);
        }

        let pano_path = result.panorama_file.unwrap();
        assert!(Path::new(&pano_path).exists());
        let pano_img = image::open(&pano_path).expect("Panorama image must be openable");
        assert_eq!(pano_img.width(), 400);
        assert_eq!(pano_img.height(), 200);

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_carousel_slicer_panorama_with_border() {
        let temp_dir = std::env::temp_dir().join(format!("carousel_border_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let photo_path = temp_dir.join("black_photo.png");
        let black_img: RgbaImage = ImageBuffer::from_pixel(100, 100, Rgba([0, 0, 0, 255]));
        black_img.save(&photo_path).unwrap();

        let payload = CarouselPayload {
            project_id: "test-carousel-border".to_string(),
            project_name: "Border Test".to_string(),
            ratio: "1:1".to_string(),
            slide_width_px: 200,
            slide_height_px: 200,
            total_slides: 1,
            slides: vec![
                CarouselSlidePayload {
                    id: "s1".to_string(),
                    slide_index: 0,
                    background_color: "#FFFFFF".to_string(),
                    elements: vec![
                        CarouselElementPayload {
                            id: "frame-1".to_string(),
                            file_path: Some(photo_path.to_string_lossy().to_string()),
                            preview_path: None,
                            name: None,
                            hidden: Some(false),
                            x: 20.0,
                            y: 20.0,
                            width: 100.0,
                            height: 100.0,
                            crop_x: None,
                            crop_y: None,
                            crop_scale: None,
                            rotation: None,
                            corner_radius: None,
                            corner_radius_tl: None,
                            corner_radius_tr: None,
                            corner_radius_br: None,
                            corner_radius_bl: None,
                            shape_type: None,
                            custom_svg_path: None,
                            border_enabled: Some(true),
                            border_width: Some(4.0),
                            border_color: Some("#FF0000".to_string()), // Red border
                            border_style: Some("solid".to_string()),
                            opacity: Some(1.0),
                        }
                    ],
                }
            ],
        };

        let pano = render_carousel_panorama(&payload);
        assert_eq!(pano.width(), 200);
        assert_eq!(pano.height(), 200);

        // Check border pixel at frame edge (x=21, y=21) -> Should be red
        let border_pixel = pano.get_pixel(21, 21);
        assert_eq!(border_pixel[0], 255, "Red channel must be 255 for border pixel");
        assert_eq!(border_pixel[1], 0, "Green channel must be 0 for red border");
        assert_eq!(border_pixel[2], 0, "Blue channel must be 0 for red border");

        // Check photo interior pixel (x=40, y=40) -> Should be black photo
        let photo_pixel = pano.get_pixel(40, 40);
        assert_eq!(photo_pixel[0], 0, "Interior pixel should be black photo");
        assert_eq!(photo_pixel[1], 0);
        assert_eq!(photo_pixel[2], 0);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
