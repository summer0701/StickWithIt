package com.stickwithit.endure;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private int lastBottomInset = -1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RunningPlugin.class);
        super.onCreate(savedInstanceState);
        configureSystemBars();
        installWindowInsetsBridge();
    }

    private void configureSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().setStatusBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }

    private void installWindowInsetsBridge() {
        if (getBridge() == null || getBridge().getWebView() == null) return;

        WebView webView = getBridge().getWebView();
        View insetTarget = (View) webView.getParent();
        if (insetTarget == null) insetTarget = webView;
        final View finalInsetTarget = insetTarget;

        ViewCompat.setOnApplyWindowInsetsListener(finalInsetTarget, (view, insets) -> {
            Insets systemBars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
            int bottomInset = keyboardVisible ? 0 : Math.max(systemBars.bottom, ime.bottom);

            injectBottomInset(bottomInset);
            return insets;
        });

        finalInsetTarget.post(() -> {
            ViewCompat.requestApplyInsets(finalInsetTarget);
            injectBottomInset(Math.max(lastBottomInset, 0));
        });
    }

    private void injectBottomInset(int bottomInsetPx) {
        if (bottomInsetPx == lastBottomInset || getBridge() == null || getBridge().getWebView() == null) return;

        lastBottomInset = bottomInsetPx;
        float density = getResources().getDisplayMetrics().density;
        int bottomInsetDp = Math.round(bottomInsetPx / density);
        String script = String.format(
            Locale.US,
            "document.documentElement.style.setProperty('--native-safe-area-inset-bottom', '%dpx');",
            bottomInsetDp
        );

        getBridge().getWebView().post(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(script, null);
            }
        });
    }
}
