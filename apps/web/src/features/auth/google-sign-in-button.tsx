import { useEffect, useMemo, useRef } from "react";

function useGoogleScript() {
  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');

    if (existing) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);
}

type GoogleSignInButtonProps = {
  clientId: string;
  disabled?: boolean;
  onCredential: (credential: string) => void;
};

export function GoogleSignInButton({ clientId, disabled = false, onCredential }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const initializedClientId = useMemo(() => clientId, [clientId]);

  useGoogleScript();

  useEffect(() => {
    if (!buttonRef.current || !initializedClientId || disabled) {
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;

    const render = () => {
      if (cancelled || !buttonRef.current || !window.google) {
        return;
      }

      buttonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: initializedClientId,
        callback: (response) => {
          if (response.credential) {
            onCredential(response.credential);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        context: "signin"
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 360,
        logo_alignment: "left"
      });
    };

    if (window.google) {
      render();
    } else {
      intervalId = window.setInterval(() => {
        if (window.google) {
          render();
          if (intervalId) {
            window.clearInterval(intervalId);
          }
        }
      }, 250);
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      window.google?.accounts.id.cancel();
    };
  }, [disabled, initializedClientId, onCredential]);

  return <div ref={buttonRef} className="min-h-[44px]" />;
}
