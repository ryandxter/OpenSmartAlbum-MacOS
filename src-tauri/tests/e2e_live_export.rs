use std::fs;
use std::path::{Path, PathBuf};
use afsn_smart_album_lib::export_engine::{
    encode_jpeg_with_dpi, render_spread_base_to_image_with_progress,
    carousel_slicer::{export_carousel_slices_worker, CarouselExportOptions, CarouselElementPayload, CarouselPayload, CarouselSlidePayload},
};
use afsn_smart_album_lib::db::{ElementPayload, ProjectRow, SpreadPayload};

const TEST_PHOTOS: &[&str] = &[
    "/Users/chiio/Downloads/RVMR9845.JPG",
    "/Users/chiio/Downloads/RVMR2316.JPG",
    "/Users/chiio/Downloads/RVMR2299.JPG",
    "/Users/chiio/Downloads/RVMR1971.JPG",
    "/Users/chiio/Downloads/RVMR9888.JPG",
    "/Users/chiio/Downloads/RVMR2662.JPG",
    "/Users/chiio/Downloads/RVMR9920.JPG",
];

const EXPORT_BASE_DIR: &str = "/Users/chiio/Downloads/album test app";

#[test]
fn test_live_e2e_export_print_album_and_carousel() {
    println!("================================================================");
    println!("🚀 Starting Live E2E Export Test using High-Resolution User Photos");
    println!("================================================================\n");

    // 1. Verify existence of all test photos
    let mut valid_photos = Vec::new();
    for path in TEST_PHOTOS {
        let p = Path::new(path);
        if p.exists() {
            println!("  ✔ Verified photo: {} ({} bytes)", p.file_name().unwrap().to_string_lossy(), fs::metadata(p).unwrap().len());
            valid_photos.push(path.to_string());
        } else {
            eprintln!("  ⚠️ Warning: photo not found: {}", path);
        }
    }

    assert!(valid_photos.len() >= 4, "Need at least 4 test photos to execute comprehensive E2E test");

    let base_out = PathBuf::from(EXPORT_BASE_DIR);
    fs::create_dir_all(&base_out).expect("Must be able to create export base dir");

    // ========================================================================
    // Part 1: Print Album High-Res (300 DPI) 5-Spread Live Export
    // ========================================================================
    println!("\n▶ [Part 1] Generating and Exporting Print Album (5 Spreads, 300 DPI)...");
    let print_out = base_out.join("print_album_300dpi");
    fs::create_dir_all(&print_out).expect("Create print album export dir");

    // Square 20x20 cm spread = 400 x 200 mm
    let project = ProjectRow {
        id: "e2e-project-live".to_string(),
        name: "E2E Live Album".to_string(),
        canvas_width: 200.0,
        canvas_height: 200.0,
        canvas_unit: "mm".to_string(),
        canvas_dpi: 300,
        spacing_value: 6.0,
        spacing_unit: "mm".to_string(),
        margin_enabled: true,
        margin_value: 15.0,
        margin_unit: "mm".to_string(),
        margin_top: Some(15.0),
        margin_bottom: Some(15.0),
        margin_outside: Some(15.0),
        margin_spine: Some(15.0),
        border_enabled: false,
        border_width: 1.0,
        border_unit: "mm".to_string(),
        border_color: "#000000".to_string(),
        background_type: "color".to_string(),
        background_color: "#FFFFFF".to_string(),
        file_path: None,
        created_at: "2026-09-23T00:00:00Z".to_string(),
        updated_at: "2026-09-23T00:00:00Z".to_string(),
    };

    let make_photo_element = |id: &str, file: &str, x: f64, y: f64, w: f64, h: f64, shape: Option<&str>| -> ElementPayload {
        ElementPayload {
            id: id.to_string(),
            r#type: "photo".to_string(),
            photo_id: Some(id.to_string()),
            file_path: file.to_string(),
            file_name: Path::new(file).file_name().unwrap().to_string_lossy().to_string(),
            preview_path: None,
            thumbnail_path: None,
            x,
            y,
            width: w,
            height: h,
            rotation: 0.0,
            z_index: 1,
            photo_aspect: 1.5,
            group_id: None,
            original_width: None,
            original_height: None,
            crop_x: 0.0,
            crop_y: 0.0,
            crop_scale: 1.0,
            crop_rotation: None,
            border_enabled: true,
            border_width: 1.0,
            border_color: "#FFFFFF".to_string(),
            opacity: 1.0,
            locked: None,
            text_payload: None,
            corner_radius_tl: 0.0,
            corner_radius_tr: 0.0,
            corner_radius_br: 0.0,
            corner_radius_bl: 0.0,
            corner_radius: None,
            shape_type: shape.map(|s| s.to_string()),
            custom_svg_path: None,
        }
    };

    // Construct 5 Spreads
    let spreads: Vec<SpreadPayload> = vec![
        // Spread 1: Cover Hero
        SpreadPayload {
            id: "sp-1".to_string(),
            spread_index: 1,
            r#type: "interior".to_string(),
            name: "Spread 01 - Hero".to_string(),
            left_page: None,
            right_page: None,
            gutter_width: 0.0,
            gutter_unit: "mm".to_string(),
            bleed: 3.0,
            safe_area: 15.0,
            safe_area_top: None,
            safe_area_bottom: None,
            safe_area_outside: None,
            safe_area_spine: None,
            spacing_value: None,
            spacing_unit: None,
            background_color: "#18181B".to_string(),
            elements: vec![
                make_photo_element("f1", &valid_photos[0], 25.0, 20.0, 350.0, 160.0, None),
            ],
        },
        // Spread 2: 2-Photos Split
        SpreadPayload {
            id: "sp-2".to_string(),
            spread_index: 2,
            r#type: "interior".to_string(),
            name: "Spread 02 - Split".to_string(),
            left_page: None,
            right_page: None,
            gutter_width: 0.0,
            gutter_unit: "mm".to_string(),
            bleed: 3.0,
            safe_area: 15.0,
            safe_area_top: None,
            safe_area_bottom: None,
            safe_area_outside: None,
            safe_area_spine: None,
            spacing_value: None,
            spacing_unit: None,
            background_color: "#FFFFFF".to_string(),
            elements: vec![
                make_photo_element("f2a", &valid_photos[1 % valid_photos.len()], 20.0, 20.0, 175.0, 160.0, None),
                make_photo_element("f2b", &valid_photos[2 % valid_photos.len()], 205.0, 20.0, 175.0, 160.0, None),
            ],
        },
        // Spread 3: 3-Photos Split
        SpreadPayload {
            id: "sp-3".to_string(),
            spread_index: 3,
            r#type: "interior".to_string(),
            name: "Spread 03 - Trio".to_string(),
            left_page: None,
            right_page: None,
            gutter_width: 0.0,
            gutter_unit: "mm".to_string(),
            bleed: 3.0,
            safe_area: 15.0,
            safe_area_top: None,
            safe_area_bottom: None,
            safe_area_outside: None,
            safe_area_spine: None,
            spacing_value: None,
            spacing_unit: None,
            background_color: "#F4F4F5".to_string(),
            elements: vec![
                make_photo_element("f3a", &valid_photos[3 % valid_photos.len()], 20.0, 20.0, 175.0, 160.0, None),
                make_photo_element("f3b", &valid_photos[4 % valid_photos.len()], 205.0, 20.0, 175.0, 75.0, None),
                make_photo_element("f3c", &valid_photos[5 % valid_photos.len()], 205.0, 105.0, 175.0, 75.0, None),
            ],
        },
        // Spread 4: 4-Photos 2x2 Grid
        SpreadPayload {
            id: "sp-4".to_string(),
            spread_index: 4,
            r#type: "interior".to_string(),
            name: "Spread 04 - Quad".to_string(),
            left_page: None,
            right_page: None,
            gutter_width: 0.0,
            gutter_unit: "mm".to_string(),
            bleed: 3.0,
            safe_area: 15.0,
            safe_area_top: None,
            safe_area_bottom: None,
            safe_area_outside: None,
            safe_area_spine: None,
            spacing_value: None,
            spacing_unit: None,
            background_color: "#FFFFFF".to_string(),
            elements: vec![
                make_photo_element("f4a", &valid_photos[0], 20.0, 20.0, 175.0, 75.0, None),
                make_photo_element("f4b", &valid_photos[1 % valid_photos.len()], 205.0, 20.0, 175.0, 75.0, None),
                make_photo_element("f4c", &valid_photos[2 % valid_photos.len()], 20.0, 105.0, 175.0, 75.0, None),
                make_photo_element("f4d", &valid_photos[3 % valid_photos.len()], 205.0, 105.0, 175.0, 75.0, None),
            ],
        },
        // Spread 5: Reshuffle with Vector Shape Masks (Heart, Star, Circle, Scallop)
        SpreadPayload {
            id: "sp-5".to_string(),
            spread_index: 5,
            r#type: "interior".to_string(),
            name: "Spread 05 - Shapes & Masks".to_string(),
            left_page: None,
            right_page: None,
            gutter_width: 0.0,
            gutter_unit: "mm".to_string(),
            bleed: 3.0,
            safe_area: 15.0,
            safe_area_top: None,
            safe_area_bottom: None,
            safe_area_outside: None,
            safe_area_spine: None,
            spacing_value: None,
            spacing_unit: None,
            background_color: "#18181B".to_string(),
            elements: vec![
                make_photo_element("f5a", &valid_photos[4 % valid_photos.len()], 20.0, 30.0, 80.0, 80.0, Some("circle")),
                make_photo_element("f5b", &valid_photos[5 % valid_photos.len()], 110.0, 30.0, 80.0, 80.0, Some("heart")),
                make_photo_element("f5c", &valid_photos[6 % valid_photos.len()], 205.0, 30.0, 80.0, 80.0, Some("star")),
                make_photo_element("f5d", &valid_photos[0], 295.0, 30.0, 80.0, 80.0, Some("scallop")),
            ],
        },
    ];

    // Render and encode each spread
    for spread in &spreads {
        print!("  Rendering {}... ", spread.name);
        let rgba_img = render_spread_base_to_image_with_progress(&project, spread, 300, true, |_, _| true);
        assert!(rgba_img.width() > 0 && rgba_img.height() > 0);
        let rgb_img = image::DynamicImage::ImageRgba8(rgba_img.clone()).to_rgb8();
        let out_file = print_out.join(format!("Spread_{:02}_{}.jpg", spread.spread_index, spread.id));
        let jpeg_bytes = encode_jpeg_with_dpi(&rgb_img, 95, 300).expect("JPEG encoding must succeed");
        fs::write(&out_file, &jpeg_bytes).expect("Write spread file");
        let meta = fs::metadata(&out_file).expect("File metadata");
        println!("✔ Done! Dimensions: {} × {} px, Size: {:.2} MB", rgba_img.width(), rgba_img.height(), meta.len() as f64 / 1_000_000.0);
        assert!(meta.len() > 100_000, "Spread export file must be valid non-trivial size");
    }

    // ========================================================================
    // Part 2: Social Carousel Live Export (All Ratios: 1:1, 4:5, 9:16)
    // ========================================================================
    println!("\n▶ [Part 2] Generating and Slicing Social Carousels (1:1, 4:5, 9:16)...");
    let carousel_base_out = base_out.join("social_carousel_slices");
    fs::create_dir_all(&carousel_base_out).expect("Create carousel export dir");

    let ratios = [("1:1", 1080u32, 1080u32), ("4:5", 1080, 1350), ("9:16", 1080, 1920)];

    for (ratio_str, slide_w, slide_h) in ratios {
        println!("  Testing Carousel Ratio: {} ({} × {} px per slide)...", ratio_str, slide_w, slide_h);

        // Build 5 slides with multi-photo, collage, and seamless panorama
        let slides: Vec<CarouselSlidePayload> = vec![
            // Slide 1: Hero
            CarouselSlidePayload {
                id: format!("sl1-{}", ratio_str),
                slide_index: 0,
                background_color: "#18181B".to_string(),
                elements: vec![
                    CarouselElementPayload {
                        id: "el1".to_string(),
                        file_path: Some(valid_photos[0].clone()),
                        preview_path: None,
                        x: 60.0,
                        y: ((slide_h as f64 - 800.0) / 2.0).max(60.0),
                        width: (slide_w - 120) as f64,
                        height: (slide_h - 200).min(800) as f64,
                        crop_x: None,
                        crop_y: None,
                        crop_scale: None,
                        rotation: None,
                        corner_radius: Some(16.0),
                        shape_type: None,
                    }
                ],
            },
            // Slide 2: 2-Stack Split
            CarouselSlidePayload {
                id: format!("sl2-{}", ratio_str),
                slide_index: 1,
                background_color: "#FFFFFF".to_string(),
                elements: vec![
                    CarouselElementPayload {
                        id: "el2a".to_string(),
                        file_path: Some(valid_photos[1 % valid_photos.len()].clone()),
                        preview_path: None,
                        x: 60.0,
                        y: 80.0,
                        width: (slide_w - 120) as f64,
                        height: ((slide_h as f64 - 200.0) / 2.0).round(),
                        crop_x: None,
                        crop_y: None,
                        crop_scale: None,
                        rotation: None,
                        corner_radius: Some(8.0),
                        shape_type: None,
                    },
                    CarouselElementPayload {
                        id: "el2b".to_string(),
                        file_path: Some(valid_photos[2 % valid_photos.len()].clone()),
                        preview_path: None,
                        x: 60.0,
                        y: 80.0 + ((slide_h as f64 - 200.0) / 2.0).round() + 20.0,
                        width: (slide_w - 120) as f64,
                        height: ((slide_h as f64 - 200.0) / 2.0).round(),
                        crop_x: None,
                        crop_y: None,
                        crop_scale: None,
                        rotation: None,
                        corner_radius: Some(8.0),
                        shape_type: None,
                    },
                ],
            },
            // Slide 3 & 4: Seamless Panorama spanning across slide 3 into slide 4!
            CarouselSlidePayload {
                id: format!("sl3-{}", ratio_str),
                slide_index: 2,
                background_color: "#0F172A".to_string(),
                elements: vec![
                    // Start of panorama at slide 3 (x = 2 * slide_w + 100), width = slide_w * 1.8
                    CarouselElementPayload {
                        id: "el-pano".to_string(),
                        file_path: Some(valid_photos[3 % valid_photos.len()].clone()),
                        preview_path: None,
                        x: (2 * slide_w + 100) as f64,
                        y: 100.0,
                        width: (slide_w as f64 * 1.8),
                        height: (slide_h - 200) as f64,
                        crop_x: None,
                        crop_y: None,
                        crop_scale: None,
                        rotation: None,
                        corner_radius: Some(12.0),
                        shape_type: None,
                    }
                ],
            },
            // Slide 4: Continues panorama + companion shape photo
            CarouselSlidePayload {
                id: format!("sl4-{}", ratio_str),
                slide_index: 3,
                background_color: "#0F172A".to_string(),
                elements: vec![],
            },
            // Slide 5: Reshuffle with Vector Shape Masks
            CarouselSlidePayload {
                id: format!("sl5-{}", ratio_str),
                slide_index: 4,
                background_color: "#18181B".to_string(),
                elements: vec![
                    CarouselElementPayload {
                        id: "el5-circle".to_string(),
                        file_path: Some(valid_photos[4 % valid_photos.len()].clone()),
                        preview_path: None,
                        x: (4 * slide_w + 80) as f64,
                        y: 120.0,
                        width: ((slide_w - 180) / 2) as f64,
                        height: ((slide_w - 180) / 2) as f64,
                        crop_x: None,
                        crop_y: None,
                        crop_scale: None,
                        rotation: None,
                        corner_radius: None,
                        shape_type: Some("circle".to_string()),
                    },
                    CarouselElementPayload {
                        id: "el5-heart".to_string(),
                        file_path: Some(valid_photos[5 % valid_photos.len()].clone()),
                        preview_path: None,
                        x: (4 * slide_w + 80 + (slide_w - 180) / 2 + 20) as f64,
                        y: 120.0,
                        width: ((slide_w - 180) / 2) as f64,
                        height: ((slide_w - 180) / 2) as f64,
                        crop_x: None,
                        crop_y: None,
                        crop_scale: None,
                        rotation: None,
                        corner_radius: None,
                        shape_type: Some("heart".to_string()),
                    },
                ],
            },
        ];

        let payload = CarouselPayload {
            project_id: format!("carousel-{}", ratio_str.replace(':', "_")),
            project_name: format!("Live_{}_Carousel", ratio_str.replace(':', "_")),
            ratio: ratio_str.to_string(),
            slide_width_px: slide_w,
            slide_height_px: slide_h,
            total_slides: 5,
            slides,
        };

        let ratio_dir = carousel_base_out.join(format!("ratio_{}", ratio_str.replace(':', "_")));
        let options = CarouselExportOptions {
            output_dir: ratio_dir.to_string_lossy().to_string(),
            jpeg_quality: 94,
            export_panorama: true,
            file_prefix: Some(format!("LiveCarousel_{}", ratio_str.replace(':', "_"))),
        };

        let result = export_carousel_slices_worker(&payload, &options).expect("Carousel export must succeed");
        assert_eq!(result.total_slides, 5);
        assert_eq!(result.slide_files.len(), 5);
        assert!(result.panorama_file.is_some());

        for (idx, slide_file) in result.slide_files.iter().enumerate() {
            let p = Path::new(slide_file);
            assert!(p.exists(), "Slide file must exist: {}", slide_file);
            let meta = fs::metadata(p).unwrap();
            let img = image::open(p).expect("Must open exported slide JPEG");
            assert_eq!(img.width(), slide_w);
            assert_eq!(img.height(), slide_h);
            println!("    • Slide {} ({:.1} KB): {} × {} px", idx + 1, meta.len() as f64 / 1024.0, img.width(), img.height());
        }

        if let Some(ref pano_file) = result.panorama_file {
            let p = Path::new(pano_file);
            assert!(p.exists());
            let meta = fs::metadata(p).unwrap();
            let img = image::open(p).expect("Must open panorama JPEG");
            assert_eq!(img.width(), slide_w * 5);
            assert_eq!(img.height(), slide_h);
            println!("    • Continuous Panorama ({:.2} MB): {} × {} px", meta.len() as f64 / 1_000_000.0, img.width(), img.height());
        }

        println!("  ✔ Ratio {} 5-Slide Package exported successfully!\n", ratio_str);
    }

    println!("================================================================");
    println!("🎉 LIVE E2E EXPORT VERIFICATION SUCCEEDED 100%!");
    println!("Output Folder: {}", EXPORT_BASE_DIR);
    println!("================================================================");
}
