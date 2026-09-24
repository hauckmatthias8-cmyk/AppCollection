package de.matthiashauck.appsammlung;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final int REQUEST_FILE_CHOOSER = 7101;
    private static final long CAPTURE_MAX_AGE_MS = 24L * 60L * 60L * 1000L;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri pendingCaptureUri;
    private File pendingCaptureFile;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(7, 17, 28));
        getWindow().setNavigationBarColor(Color.rgb(7, 17, 28));
        getWindow().getDecorView().setSystemUiVisibility(0);

        cleanupOldCaptures();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7, 17, 28));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                // Die App-Sammlung ist absichtlich lokal. Externe Webnavigation ist gesperrt.
                return !("file".equalsIgnoreCase(scheme) || "content".equalsIgnoreCase(scheme));
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri uri = Uri.parse(url);
                String scheme = uri.getScheme();
                return !("file".equalsIgnoreCase(scheme) || "content".equalsIgnoreCase(scheme));
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams fileChooserParams) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                return openImageChooser();
            }
        });

        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private boolean openImageChooser() {
        Intent gallery = new Intent(Intent.ACTION_GET_CONTENT);
        gallery.addCategory(Intent.CATEGORY_OPENABLE);
        gallery.setType("image/*");

        List<Intent> extraIntents = new ArrayList<>();
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) != null) {
            try {
                File dir = new File(getCacheDir(), "camera");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Capture directory unavailable");
                String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.ROOT).format(new Date());
                pendingCaptureFile = new File(dir, "HauckiApp_" + stamp + ".jpg");
                pendingCaptureUri = CaptureFileProvider.uriFor(this, pendingCaptureFile);

                camera.putExtra(MediaStore.EXTRA_OUTPUT, pendingCaptureUri);
                camera.setClipData(ClipData.newRawUri("App capture", pendingCaptureUri));
                camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                extraIntents.add(camera);
            } catch (Exception e) {
                pendingCaptureUri = null;
                pendingCaptureFile = null;
            }
        }

        Intent chooser = Intent.createChooser(gallery, "Foto aufnehmen oder auswählen");
        if (!extraIntents.isEmpty()) {
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, extraIntents.toArray(new Intent[0]));
        }

        try {
            startActivityForResult(chooser, REQUEST_FILE_CHOOSER);
            return true;
        } catch (Exception e) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(null);
                fileCallback = null;
            }
            deletePendingCapture();
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_FILE_CHOOSER) return;

        Uri[] result = null;
        boolean usedCamera = false;

        if (resultCode == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                ClipData clip = data.getClipData();
                result = new Uri[clip.getItemCount()];
                for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            } else if (pendingCaptureUri != null && pendingCaptureFile != null && pendingCaptureFile.length() > 0) {
                result = new Uri[]{pendingCaptureUri};
                usedCamera = true;
            }
        }

        if (!usedCamera) deletePendingCapture();

        if (fileCallback != null) {
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }

        if (usedCamera) {
            // Keep the capture in private cache while the WebView reads it.
            pendingCaptureUri = null;
            pendingCaptureFile = null;
        }
    }

    private void deletePendingCapture() {
        if (pendingCaptureFile != null) {
            //noinspection ResultOfMethodCallIgnored
            pendingCaptureFile.delete();
        }
        pendingCaptureUri = null;
        pendingCaptureFile = null;
    }

    private void cleanupOldCaptures() {
        File dir = new File(getCacheDir(), "camera");
        File[] files = dir.listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - CAPTURE_MAX_AGE_MS;
        for (File file : files) {
            if (file.isFile() && file.lastModified() < cutoff) {
                //noinspection ResultOfMethodCallIgnored
                file.delete();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
