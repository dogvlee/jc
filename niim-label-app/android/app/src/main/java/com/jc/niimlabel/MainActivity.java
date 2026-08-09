package com.jc.niimlabel;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android's edge-to-edge WebView can keep visualViewport at full height
        // while the IME overlays the page. Forward the real native IME inset to
        // the editor so its compact content bar stays immediately above it.
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) return;

        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
            int imeBottomPx = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
            float density = getResources().getDisplayMetrics().density;
            int imeBottomCssPx = density > 0 ? Math.round(imeBottomPx / density) : imeBottomPx;
            String script = "window.__niimSetKeyboardInset&&window.__niimSetKeyboardInset("
                    + imeBottomCssPx + ");";
            webView.post(() -> webView.evaluateJavascript(script, null));
            return insets;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
