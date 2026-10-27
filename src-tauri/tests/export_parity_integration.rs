use std::fs;
use std::path::PathBuf;
use afsn_smart_album_lib::db::{
    ElementPayload, ProjectRow, SpreadBackgroundImagePayload, SpreadPayload,
};
use afsn_smart_album_lib::export_engine::{
    assemble_pdf_from_jpegs, encode_jpeg_with_dpi, encode_png_with_dpi, encode_tiff_with_dpi,
    render_spread_base_to_image_with_progress, render_spread_text_to_canvas, render_spread_to_psd,
    carousel_slicer::{
        export_carousel_slices_worker, CarouselElementPayload, CarouselExportOptions,
        CarouselPayload, CarouselSlidePayload,
    },
    ExportOptions,
};
use image::{ImageBuffer, Rgb, Rgba};

#[test]
fn test_300dpi_export_parity_jpeg_png_tiff_pdf_psd_and_carousel() {
    let temp_dir = std::env::temp_dir().join(format!("albumaker_test_parity_{}", std::process::id()));
    fs::create_dir_all(&temp_dir).expect("Create test temp dir");

    // 1. Create fixture images
    let photo_path = temp_dir.join("fixture_photo.jpg");
    let mut photo_buf = ImageBuffer::from_pixel(600, 400, Rgb([180u8, 120u8, 60u8]));
    for y in 0..400 {
        for x in 0..600 {
            photo_buf.put_pixel(x, y, Rgb([(x % 256) as u8, (y % 256) as u8, 150u8]));
        }
    }
    photo_buf.save(&photo_path).expect("Save test photo");

    let bg_path = temp_dir.join("fixture_bg.png");
    let bg_buf = ImageBuffer::from_pixel(400, 400, Rgba([30u8, 40u8, 60u8, 255u8]));
    bg_buf.save(&bg_path).expect("Save test bg");

    let sticker_path = temp_dir.join("fixture_sticker.png");
    let mut sticker_buf = ImageBuffer::from_pixel(150, 150, Rgba([0u8, 0u8, 0u8, 0u8]));
    for y in 20..130 {
        for x in 20..130 {
            sticker_buf.put_pixel(x, y, Rgba([255u8, 215u8, 0u8, 240u8])); // Golden sticker
        }
    }
    sticker_buf.save(&sticker_path).expect("Save test sticker");

    let overlay_path = temp_dir.join("fixture_overlay.png");
    let mut overlay_buf = ImageBuffer::from_pixel(300, 300, Rgba([0u8, 0u8, 0u8, 0u8]));
    for y in 0..300 {
        for x in 0..300 {
            if x < 15 || x >= 285 || y < 15 || y >= 285 {
                overlay_buf.put_pixel(x, y, Rgba([255u8, 255u8, 255u8, 250u8]));
            }
        }
    }
    overlay_buf.save(&overlay_path).expect("Save test frame overlay");

    // 2. Set up Project & Spread with all v1.4.14 features
    let project = ProjectRow {
        id: "proj-parity-test".to_string(),
        name: "Parity Test Project".to_string(),
        canvas_width: 500.0,
        canvas_height: 400.0,
        canvas_unit: "px".to_string(),
        canvas_dpi: 300,
        margin_enabled: true,
        margin_value: 20.0,
        margin_unit: "px".to_string(),
        margin_top: Some(20.0),
        margin_bottom: Some(20.0),
        margin_outside: Some(20.0),
        margin_spine: Some(20.0),
        ..Default::default()
    };

    let text_payload_json = serde_json::json!({
        "text": "OpenSmartAlbum High-DPI Typography Parity",
        "fontFamily": "Inter",
        "fontSize": 18,
        "fill": "#333333",
        "align": "center",
        "letterSpacing": 1.5,
        "lineHeight": 1.25
    }).to_string();

    let spread = SpreadPayload {
        id: "spread-1".to_string(),
        spread_index: 0,
        r#type: "interior".to_string(),
        name: "Spread 1".to_string(),
        bleed: 10.0,
        safe_area: 20.0,
        safe_area_top: Some(20.0),
        safe_area_bottom: Some(20.0),
        safe_area_outside: Some(20.0),
        safe_area_spine: Some(20.0),
        background_color: "#F8F8F8".to_string(),
        background_color_noise: Some(0.12),
        background_image: Some(SpreadBackgroundImagePayload {
            file_path: bg_path.to_string_lossy().to_string(),
            opacity: 0.75,
            flip_horizontal: Some(true),
            flip_vertical: Some(false),
            grayscale_amount: Some(0.3),
            noise_amount: Some(0.08),
            blur_radius: Some(1.0),
            ..Default::default()
        }),
        border_enabled: Some(true),
        border_width: Some(2.0),
        border_color: Some("#C5A059".to_string()),
        elements: vec![
            // Photo Frame with full visual filters, shadow, and decorative frame overlay
            ElementPayload {
                id: "photo-1".to_string(),
                r#type: "photo".to_string(),
                file_path: photo_path.to_string_lossy().to_string(),
                x: 40.0,
                y: 40.0,
                width: 200.0,
                height: 200.0,
                rotation: 0.0,
                z_index: 1,
                opacity: 0.95,
                crop_x: 0.0,
                crop_y: 0.0,
                crop_scale: 1.0,
                crop_rotation: None,
                flip_horizontal: true,
                flip_vertical: false,
                grayscale_amount: 0.4,
                noise_amount: 0.15,
                blur_radius: 1.0,
                shadow_enabled: true,
                shadow_blur: 6.0,
                shadow_offset_x: 4.0,
                shadow_offset_y: 4.0,
                shadow_opacity: 0.6,
                shadow_color: "#000000".to_string(),
                frame_asset_local_path: Some(overlay_path.to_string_lossy().to_string()),
                frame_asset_title: Some("Vintage Gold Frame".to_string()),
                corner_radius_tl: 8.0,
                corner_radius_tr: 8.0,
                corner_radius_br: 8.0,
                corner_radius_bl: 8.0,
                border_enabled: true,
                border_width: 1.5,
                border_color: "#FFFFFF".to_string(),
                ..Default::default()
            },
            // Graphic / Sticker Element
            ElementPayload {
                id: "graphic-1".to_string(),
                r#type: "graphic".to_string(),
                file_path: sticker_path.to_string_lossy().to_string(),
                x: 300.0,
                y: 50.0,
                width: 80.0,
                height: 80.0,
                z_index: 2,
                opacity: 0.9,
                ..Default::default()
            },
            // Rich-Text Element
            ElementPayload {
                id: "text-1".to_string(),
                r#type: "text".to_string(),
                x: 280.0,
                y: 180.0,
                width: 180.0,
                height: 50.0,
                z_index: 3,
                opacity: 1.0,
                text_payload: Some(text_payload_json),
                ..Default::default()
            },
        ],
        ..Default::default()
    };

    let dpi = 300;
    let include_bleed = true;

    // ========================================================================
    // 3. Render High-DPI Base & Text Canvas
    // ========================================================================
    let mut canvas = render_spread_base_to_image_with_progress(&project, &spread, dpi, include_bleed, |_, _| true);
    assert!(canvas.width() > 0 && canvas.height() > 0, "Canvas must have positive dimensions");
    render_spread_text_to_canvas(&mut canvas, &project, &spread, dpi, include_bleed, 0.0);

    let rgb_img = image::DynamicImage::ImageRgba8(canvas.clone()).to_rgb8();

    // 4. Encode to 300 DPI JPEG
    let jpeg_bytes = encode_jpeg_with_dpi(&rgb_img, 95, dpi).expect("Encode JPEG at 300 DPI");
    assert!(!jpeg_bytes.is_empty(), "JPEG output must not be empty");
    let jpeg_dest = temp_dir.join("spread_export.jpg");
    fs::write(&jpeg_dest, &jpeg_bytes).expect("Write JPEG file");
    println!("  ✔ Exported 300 DPI JPEG: {} bytes", jpeg_bytes.len());

    // 5. Encode to 300 DPI PNG
    let png_bytes = encode_png_with_dpi(&canvas, dpi).expect("Encode PNG at 300 DPI");
    assert!(!png_bytes.is_empty(), "PNG output must not be empty");
    let png_dest = temp_dir.join("spread_export.png");
    fs::write(&png_dest, &png_bytes).expect("Write PNG file");
    println!("  ✔ Exported 300 DPI PNG: {} bytes", png_bytes.len());

    // 6. Encode to 300 DPI TIFF (LZW compressed, 8-bit)
    let tiff_dest = temp_dir.join("spread_export.tif");
    encode_tiff_with_dpi(&tiff_dest, &canvas, dpi, false).expect("Encode TIFF at 300 DPI");
    let tiff_meta = fs::metadata(&tiff_dest).expect("TIFF exists");
    assert!(tiff_meta.len() > 0, "TIFF output must not be empty");
    println!("  ✔ Exported 300 DPI TIFF: {} bytes", tiff_meta.len());

    // 7. Assemble PDF/X-3
    let pdf_dest = temp_dir.join("spread_export.pdf");
    let pdf_opts = ExportOptions {
        format: "pdf".to_string(),
        dpi,
        jpeg_quality: 95,
        include_bleed: true,
        split_pages: false,
        sharpen_enabled: false,
        sharpen_amount: "standard".to_string(),
        output_dir: temp_dir.to_string_lossy().to_string(),
        selected_spread_ids: None,
        selected_page_numbers: None,
        file_prefix: None,
        tiff_bit_depth: None,
        tiff_compression: None,
        pdf_print_ready: true,
        slug_mm: 5.0,
        crop_marks: true,
    };
    assemble_pdf_from_jpegs(
        &[(jpeg_dest.clone(), canvas.width(), canvas.height())],
        &pdf_dest,
        dpi,
        Some(&pdf_opts),
        Some("Parity Test Project"),
        spread.bleed,
    ).expect("Assemble PDF/X-3 print document");
    let pdf_meta = fs::metadata(&pdf_dest).expect("PDF exists");
    assert!(pdf_meta.len() > 0, "PDF must not be empty");
    println!("  ✔ Exported PDF/X-3: {} bytes", pdf_meta.len());

    // 8. Render to Layered Adobe Photoshop PSD
    let psd_dest = temp_dir.join("spread_export.psd");
    render_spread_to_psd(&project, &spread, dpi, include_bleed, &psd_dest)
        .expect("Render spread to layered PSD");
    let psd_meta = fs::metadata(&psd_dest).expect("PSD exists");
    assert!(psd_meta.len() > 100, "PSD must contain header and layered content");
    println!("  ✔ Exported Layered PSD: {} bytes", psd_meta.len());

    // ========================================================================
    // 9. Carousel Export Parity Test (continuous panorama + slices)
    // ========================================================================
    let carousel_payload = CarouselPayload {
        project_id: "carousel-parity-test".to_string(),
        project_name: "Carousel Parity".to_string(),
        ratio: "4:5".to_string(),
        slide_width_px: 1080,
        slide_height_px: 1350,
        total_slides: 2,
        slides: vec![
            CarouselSlidePayload {
                id: "slide-1".to_string(),
                slide_index: 0,
                background_color: "#1A1A1A".to_string(),
                background_image: Some(SpreadBackgroundImagePayload {
                    file_path: bg_path.to_string_lossy().to_string(),
                    opacity: 0.6,
                    ..Default::default()
                }),
                background_color_noise: Some(0.1),
                elements: vec![
                    CarouselElementPayload {
                        id: "c-elem-1".to_string(),
                        file_path: Some(photo_path.to_string_lossy().to_string()),
                        x: 100.0,
                        y: 150.0,
                        width: 880.0,
                        height: 900.0,
                        flip_horizontal: Some(true),
                        grayscale_amount: Some(0.2),
                        noise_amount: Some(0.1),
                        blur_radius: Some(1.0),
                        shadow_enabled: Some(true),
                        shadow_opacity: Some(0.5),
                        frame_asset_local_path: Some(overlay_path.to_string_lossy().to_string()),
                        ..Default::default()
                    },
                ],
            },
            CarouselSlidePayload {
                id: "slide-2".to_string(),
                slide_index: 1,
                background_color: "#1A1A1A".to_string(),
                background_image: None,
                background_color_noise: None,
                elements: vec![
                    CarouselElementPayload {
                        id: "c-elem-2".to_string(),
                        file_path: Some(sticker_path.to_string_lossy().to_string()),
                        r#type: Some("graphic".to_string()),
                        x: 1200.0,
                        y: 300.0,
                        width: 300.0,
                        height: 300.0,
                        ..Default::default()
                    },
                ],
            },
        ],
    };

    let carousel_out = temp_dir.join("carousel_slices");
    fs::create_dir_all(&carousel_out).expect("Create carousel out dir");
    let carousel_opts = CarouselExportOptions {
        output_dir: carousel_out.to_string_lossy().to_string(),
        jpeg_quality: 95,
        export_panorama: true,
        file_prefix: Some("insta_".to_string()),
    };

    let carousel_result = export_carousel_slices_worker(&carousel_payload, &carousel_opts)
        .expect("Export carousel slices");
    assert_eq!(carousel_result.total_slides, 2, "Must export 2 slides");
    assert_eq!(carousel_result.slide_files.len(), 2, "Must have 2 generated slice files");
    for path in &carousel_result.slide_files {
        let p = PathBuf::from(path);
        assert!(p.exists() && fs::metadata(&p).unwrap().len() > 0, "Slice file must exist and be non-empty: {:?}", p);
    }
    println!("  ✔ Exported 2 Carousel Slices: {:?}", carousel_result.slide_files);

    // Clean up
    let _ = fs::remove_dir_all(&temp_dir);
    println!("\n🎉 All 300 DPI Export Parity and Carousel tests passed successfully!");
}
