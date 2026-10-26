#import <Cocoa/Cocoa.h>

typedef void (*ColorCallback)(const char *hex_str, void *context);

void pick_color_with_nscolorsampler(ColorCallback callback, void *context) {
    if (@available(macOS 10.15, *)) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSColorSampler *sampler = [[NSColorSampler alloc] init];
            [sampler showSamplerWithSelectionHandler:^(NSColor * _Nullable selectedColor) {
                if (selectedColor) {
                    NSColor *srgbColor = [selectedColor colorUsingColorSpace:[NSColorSpace sRGBColorSpace]];
                    if (srgbColor) {
                        int r = (int)round([srgbColor redComponent] * 255.0);
                        int g = (int)round([srgbColor greenComponent] * 255.0);
                        int b = (int)round([srgbColor blueComponent] * 255.0);
                        char hex[16];
                        snprintf(hex, sizeof(hex), "#%02X%02X%02X", r, g, b);
                        callback(hex, context);
                        return;
                    }
                }
                callback(NULL, context);
            }];
        });
    } else {
        callback(NULL, context);
    }
}
