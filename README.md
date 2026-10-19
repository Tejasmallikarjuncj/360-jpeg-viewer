# 360° JPEG Viewer

A dependency-free panorama viewer. Open a JPEG using the file picker or drag and drop. Full 360° panoramas normally use an equirectangular 2:1 image. Other aspect ratios default to flat view; the view selector can override this.

There is no application file-size limit. Browser memory and image-decoding limits still apply. Large images are resized for the graphics device before rendering.

JPEGs load through image load/error events, without Image.decode(). If WebGL is unavailable, images open in flat view. HEIC/HEIF files receive a separate message asking you to export or convert them to JPEG; the viewer does not convert HEIC files.

Cloud import offers two paths: Browse cloud files uses the operating system's file picker (including cloud providers available on the device), and Import link downloads a public HTTPS JPEG directly in the browser. The host must allow cross-origin downloads; sharing-page links and sign-in-required URLs are not supported. Use the file picker for those files. Link imports omit credentials and referrers, and closing the import dialog cancels an active download. No account integration, proxy, or server upload is used.

Drag or swipe to rotate, scroll or pinch to zoom, use the arrow keys to look around, or use the reset and fullscreen controls. Images are decoded locally and are never uploaded. A regular photograph cannot provide unseen surroundings or true 3D geometry.

Open index.html locally, or serve the directory with `python -m http.server 8080`. GitHub Pages serves index.html from the main branch root. No build or dependencies are required.
