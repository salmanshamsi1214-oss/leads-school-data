import { useEffect, useState, useCallback } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Floating scroll-to-top / scroll-to-bottom navigation buttons.
 * Appears when the user scrolls down past a threshold.
 */
export function ScrollNavButtons() {
  const [show, setShow] = useState(false);

  const onScroll = useCallback(() => {
    const main = document.querySelector("main");
    if (main) {
      setShow(main.scrollTop > 200);
    } else {
      setShow(window.scrollY > 200);
    }
  }, []);

  useEffect(() => {
    const main = document.querySelector("main");
    const target = main ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => target.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const scrollToTop = () => {
    const main = document.querySelector("main");
    if (main) {
      main.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const scrollToBottom = () => {
    const main = document.querySelector("main");
    if (main) {
      main.scrollTo({ top: main.scrollHeight, behavior: "smooth" });
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 print-hidden">
      <Button
        onClick={scrollToTop}
        size="icon"
        className={cn(
          "h-11 w-11 rounded-full shadow-lg cursor-pointer",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "border border-primary/20",
          "transition-all duration-200 hover:scale-110 hover:shadow-xl",
          "backdrop-blur-sm"
        )}
        aria-label="Scroll to top"
      >
        <ArrowUp className="size-5" />
      </Button>
      <Button
        onClick={scrollToBottom}
        size="icon"
        className={cn(
          "h-11 w-11 rounded-full shadow-lg cursor-pointer",
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          "border border-border",
          "transition-all duration-200 hover:scale-110 hover:shadow-xl",
          "backdrop-blur-sm"
        )}
        aria-label="Scroll to bottom"
      >
        <ArrowDown className="size-5" />
      </Button>
    </div>
  );
}
