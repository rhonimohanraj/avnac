import {
  AiMagicIcon,
  CropIcon,
  FileExportIcon,
  GeometricShapes02Icon,
  Image01Icon,
  TextBoldIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValueEvent,
} from "motion/react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { usePostHog } from "posthog-js/react";
import NewCanvasDialog from "../components/new-canvas-dialog";
import { idbListDocuments } from "../lib/avnac-editor-idb";

export const Route = createFileRoute("/")({ component: Landing });

type Sticker = {
  id: string;
  src: string;
  label: string;
  rotation: number;
  size: string;
  desktop: {
    x: number;
    y: number;
  };
  mobile: {
    x: number;
    y: number;
  };
};

const initialStickers: Sticker[] = [
  {
    id: "sunflower",
    src: "/stickers/sunflower-badge.webp",
    label: "Sunflower sticker",
    rotation: 6,
    size: "clamp(5.6rem, 10.8vw, 8.8rem)",
    desktop: { x: 74, y: 12 },
    mobile: { x: 37, y: 15 },
  },
  {
    id: "star",
    src: "/stickers/shooting-star-badge.webp",
    label: "Shooting star sticker",
    rotation: -7,
    size: "clamp(4.4rem, 8.8vw, 7.4rem)",
    desktop: { x: 9, y: 12 },
    mobile: { x: 7, y: 16 },
  },
  {
    id: "pineapple",
    src: "/stickers/pineapple.webp",
    label: "Pineapple sticker",
    rotation: 7,
    size: "clamp(5.4rem, 11.2vw, 9.1rem)",
    desktop: { x: 77, y: 70 },
    mobile: { x: 68, y: 74 },
  },
  {
    id: "donut",
    src: "/stickers/donut.webp",
    label: "Donut sticker",
    rotation: -8,
    size: "clamp(4.9rem, 9.6vw, 8rem)",
    desktop: { x: 16, y: 73 },
    mobile: { x: 8, y: 76 },
  },
  {
    id: "lollipop",
    src: "/stickers/lollipop.webp",
    label: "Lollipop sticker",
    rotation: 12,
    size: "clamp(4.1rem, 8vw, 6.5rem)",
    desktop: { x: 80, y: 45 },
    mobile: { x: 72, y: 15 },
  },
  {
    id: "leaf",
    src: "/stickers/leaf.webp",
    label: "Leaf sticker",
    rotation: -11,
    size: "clamp(4rem, 7.8vw, 6.2rem)",
    desktop: { x: 11, y: 47 },
    mobile: { x: 40, y: 77 },
  },
];

type EssentialTool = {
  name: string;
  note: string;
  icon: IconSvgElement;
  accent: string;
  accentSoft: string;
  glow: string;
};

const essentialTools: EssentialTool[] = [
  {
    name: "Text",
    note: "Type, hierarchy, and alignment.",
    icon: TextBoldIcon,
    accent: "#ef8b74",
    accentSoft: "rgba(239, 139, 116, 0.22)",
    glow: "rgba(255, 205, 167, 0.58)",
  },
  {
    name: "Shapes",
    note: "Clean primitives for quick composition.",
    icon: GeometricShapes02Icon,
    accent: "#f0a74b",
    accentSoft: "rgba(240, 167, 75, 0.22)",
    glow: "rgba(255, 223, 153, 0.55)",
  },
  {
    name: "Images",
    note: "Drop in assets and build around them.",
    icon: Image01Icon,
    accent: "#89a36f",
    accentSoft: "rgba(137, 163, 111, 0.2)",
    glow: "rgba(198, 221, 171, 0.5)",
  },
  {
    name: "Crop",
    note: "Trim the frame without losing the energy.",
    icon: CropIcon,
    accent: "#5d9bc7",
    accentSoft: "rgba(93, 155, 199, 0.2)",
    glow: "rgba(162, 210, 238, 0.5)",
  },
  {
    name: "Magic",
    note: "Prompt a first pass or a sharper edit.",
    icon: AiMagicIcon,
    accent: "#c47fd7",
    accentSoft: "rgba(196, 127, 215, 0.2)",
    glow: "rgba(223, 190, 241, 0.52)",
  },
  {
    name: "Export",
    note: "Push the final image out when it lands.",
    icon: FileExportIcon,
    accent: "#f17f8f",
    accentSoft: "rgba(241, 127, 143, 0.18)",
    glow: "rgba(255, 191, 205, 0.54)",
  },
];

type DragState = {
  mode: "drag" | "rotate";
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startLeft: number;
  startTop: number;
  startRotation: number;
  centerX: number;
  centerY: number;
  startPointerAngle: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function useCompactHeroStickerLayout() {
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 640px)").matches
      : false,
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return compact;
}

function Landing() {
  const navigate = Route.useNavigate();
  const [newCanvasOpen, setNewCanvasOpen] = useState(false);
  const [savedFileCount, setSavedFileCount] = useState<number | null>(null);
  const [stickers, setStickers] = useState(initialStickers);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);
  const [activeToolIndex, setActiveToolIndex] = useState(0);
  const [toolDirection, setToolDirection] = useState(1);
  const posthog = usePostHog();
  const stickerLayerRef = useRef<HTMLDivElement | null>(null);
  const toolsSectionRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const activeToolIndexRef = useRef(0);
  const compactHeroStickerLayout = useCompactHeroStickerLayout();
  const { scrollYProgress } = useScroll({
    target: toolsSectionRef,
    offset: ["start start", "end end"],
  });
  const smoothToolsProgress = useSpring(scrollYProgress, {
    stiffness: 210,
    damping: 32,
    mass: 0.22,
  });
  const toolStops = essentialTools.map((_, index) =>
    index / Math.max(essentialTools.length - 1, 1),
  );
  const stageAccentSoft = useTransform(
    smoothToolsProgress,
    toolStops,
    essentialTools.map((tool) => tool.accentSoft),
  );
  const stageGlow = useTransform(
    smoothToolsProgress,
    toolStops,
    essentialTools.map((tool) => tool.glow),
  );

  useEffect(() => {
    let cancelled = false;
    void idbListDocuments()
      .then((docs) => {
        if (!cancelled) setSavedFileCount(docs.length);
      })
      .catch(() => {
        if (!cancelled) setSavedFileCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useMotionValueEvent(smoothToolsProgress, "change", (latest) => {
    const nextIndex = Math.min(
      essentialTools.length - 1,
      Math.max(
        0,
        Math.round(latest * Math.max(essentialTools.length - 1, 1)),
      ),
    );
    const previousIndex = activeToolIndexRef.current;
    if (nextIndex === previousIndex) {
      return;
    }
    activeToolIndexRef.current = nextIndex;
    setToolDirection(nextIndex > previousIndex ? 1 : -1);
    setActiveToolIndex(nextIndex);
  });

  const updateStickerPosition = useCallback((
    stickerId: string,
    clientX: number,
    clientY: number,
  ) => {
    const layer = stickerLayerRef.current;
    const dragState = dragStateRef.current;
    if (!layer || !dragState || dragState.id !== stickerId) {
      return;
    }

    if (dragState.mode === "rotate") {
      const pointerAngle = Math.atan2(
        clientY - dragState.centerY,
        clientX - dragState.centerX,
      );
      const rotation =
        dragState.startRotation +
        radiansToDegrees(pointerAngle - dragState.startPointerAngle);

      setStickers((current) =>
        current.map((sticker) =>
          sticker.id === stickerId ? { ...sticker, rotation } : sticker,
        ),
      );
      return;
    }

    const layerRect = layer.getBoundingClientRect();
    const positionKey = compactHeroStickerLayout ? "mobile" : "desktop";
    const nextLeft = clamp(
      dragState.startLeft + (clientX - dragState.startClientX),
      0,
      Math.max(layerRect.width - dragState.width, 0),
    );
    const nextTop = clamp(
      dragState.startTop + (clientY - dragState.startClientY),
      0,
      Math.max(layerRect.height - dragState.height, 0),
    );

    setStickers((current) =>
      current.map((sticker) =>
        sticker.id === stickerId
          ? {
              ...sticker,
              [positionKey]: {
                x: (nextLeft / Math.max(layerRect.width, 1)) * 100,
                y: (nextTop / Math.max(layerRect.height, 1)) * 100,
              },
            }
          : sticker,
      ),
    );
  }, [compactHeroStickerLayout]);

  const endDrag = (pointerId: number, target: EventTarget | null) => {
    if (dragStateRef.current?.pointerId !== pointerId) {
      return;
    }

    if (target instanceof HTMLElement && target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }

    dragStateRef.current = null;
    setActiveStickerId(null);
  };

  const openEditor = useCallback(() => {
    void (async () => {
      try {
        const docs = await idbListDocuments();
        setSavedFileCount(docs.length);
        const destination = docs.length > 0 ? "/files" : "/create";
        posthog.capture("editor_opened", {
          source: "landing_hero",
          destination,
          existing_file_count: docs.length,
        });
        if (docs.length > 0) {
          await navigate({ to: "/files" });
          return;
        }
      } catch (err) {
        posthog.captureException(err);
      }
      setNewCanvasOpen(true);
    })();
  }, [navigate, posthog]);

  const hasSavedFiles = (savedFileCount ?? 0) > 0;
  const primaryCtaLabel = hasSavedFiles ? "Open files" : "Open editor";
  const heroBody = hasSavedFiles
    ? "You already have saved work in this browser. Open your files and keep editing."
    : "Avnac is an open canvas for layouts, posters, and graphics.";
  const activeTool = essentialTools[activeToolIndex];
  const toolsShellStyle = {
    "--tool-accent-soft": activeTool.accentSoft,
    "--tool-glow": activeTool.glow,
    minHeight: `${essentialTools.length * 68}vh`,
  } as CSSProperties;
  const toolsMotionStyle = {
    ...toolsShellStyle,
    "--tool-accent-soft": stageAccentSoft,
    "--tool-glow": stageGlow,
  } as CSSProperties;

  return (
    <main className="landing-page">
      <section className="hero-page relative flex min-h-[100dvh] flex-col justify-center overflow-hidden px-5 py-16 sm:px-10 sm:py-20 lg:px-16 lg:py-24">
        <div className="hero-bg-orb hero-bg-orb-a" aria-hidden="true" />
        <div className="hero-bg-orb hero-bg-orb-b" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" />
        <div ref={stickerLayerRef} className="hero-sticker-layer" aria-hidden="true">
          {stickers.map((sticker) => (
            (() => {
              const pos = compactHeroStickerLayout
                ? sticker.mobile
                : sticker.desktop;

              return (
                <div
                  key={sticker.id}
                  className={`hero-sticker-frame ${activeStickerId === sticker.id ? "is-active" : ""}`}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    width: sticker.size,
                    transform: `rotate(${sticker.rotation}deg)`,
                    zIndex: activeStickerId === sticker.id ? 3 : 1,
                  }}
                  onPointerDown={(e) => {
                    const layer = stickerLayerRef.current;
                    if (!layer) {
                      return;
                    }

                    const layerRect = layer.getBoundingClientRect();
                    const stickerLeft =
                      (pos.x / 100) * Math.max(layerRect.width, 1);
                    const stickerTop =
                      (pos.y / 100) * Math.max(layerRect.height, 1);

                    dragStateRef.current = {
                      mode: "drag",
                      id: sticker.id,
                      pointerId: e.pointerId,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startLeft: stickerLeft,
                      startTop: stickerTop,
                      startRotation: sticker.rotation,
                      centerX:
                        e.currentTarget.getBoundingClientRect().left +
                        e.currentTarget.offsetWidth / 2,
                      centerY:
                        e.currentTarget.getBoundingClientRect().top +
                        e.currentTarget.offsetHeight / 2,
                      startPointerAngle: 0,
                      width: e.currentTarget.offsetWidth,
                      height: e.currentTarget.offsetHeight,
                    };
                    setActiveStickerId(sticker.id);
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    updateStickerPosition(sticker.id, e.clientX, e.clientY);
                  }}
                  onPointerUp={(e) => {
                    endDrag(e.pointerId, e.target);
                  }}
                  onPointerCancel={(e) => {
                    endDrag(e.pointerId, e.target);
                  }}
                >
                  <span className="hero-sticker-selection" />
                  <span className="hero-sticker-handle hero-sticker-handle-nw" />
                  <span
                    className="hero-sticker-rotation-arm"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const frame = e.currentTarget.parentElement;
                      if (!frame) {
                        return;
                      }

                      const frameRect = frame.getBoundingClientRect();
                      const centerX = frameRect.left + frameRect.width / 2;
                      const centerY = frameRect.top + frameRect.height / 2;

                      dragStateRef.current = {
                        mode: "rotate",
                        id: sticker.id,
                        pointerId: e.pointerId,
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                        startLeft: 0,
                        startTop: 0,
                        startRotation: sticker.rotation,
                        centerX,
                        centerY,
                        startPointerAngle: Math.atan2(
                          e.clientY - centerY,
                          e.clientX - centerX,
                        ),
                        width: frameRect.width,
                        height: frameRect.height,
                      };
                      setActiveStickerId(sticker.id);
                      frame.setPointerCapture(e.pointerId);
                    }}
                  >
                    <span className="hero-sticker-rotation-handle" />
                  </span>
                  <span className="hero-sticker-handle hero-sticker-handle-ne" />
                  <span className="hero-sticker-handle hero-sticker-handle-e" />
                  <span className="hero-sticker-handle hero-sticker-handle-se" />
                  <span className="hero-sticker-handle hero-sticker-handle-s" />
                  <span className="hero-sticker-handle hero-sticker-handle-sw" />
                  <span className="hero-sticker-handle hero-sticker-handle-w" />
                  <img
                    src={sticker.src}
                    alt={sticker.label}
                    className="hero-sticker-image"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </div>
              );
            })()
          ))}
        </div>
        <div className="relative z-[1] mx-auto w-full max-w-3xl">
          <div className="rise-in text-left">
            <h1 className="display-title hero-headline mb-8 font-medium text-balance text-[var(--text)] sm:mb-10 lg:mb-12">
              Design in the browser,
              <br />
              openly.
            </h1>
            <p className="mb-10 max-w-xl text-lg leading-[1.6] text-[var(--text-muted)] sm:mb-12 sm:text-xl sm:leading-[1.55] lg:text-[1.375rem] lg:leading-[1.5]">
              {heroBody}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                className="bg-black text-white inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border-0 px-10 py-3.5 text-base font-medium sm:min-h-14 sm:px-12 sm:py-4 sm:text-[1.0625rem]"
                onClick={openEditor}
              >
                {primaryCtaLabel}
              </button>
              <a
                href="https://github.com/akinloluwami/avnac"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/[0.14] bg-white/70 px-8 py-3.5 text-base font-medium text-[var(--text)] no-underline backdrop-blur-sm hover:border-black/[0.22] hover:bg-white sm:min-h-14 sm:px-10 sm:py-4 sm:text-[1.0625rem]"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-last">
        <div className="landing-container">
          <motion.div
            ref={toolsSectionRef}
            className="landing-tools-shell"
            style={toolsMotionStyle}
          >
            <div className="landing-tools-sticky">
              <div className="landing-tools-left">
                <div className="landing-tools-left-header">
                  <h2 className="display-title landing-tools-left-title">
                    All the essential tools
                  </h2>
                </div>
                <div className="landing-tools-stage">
                  <div className="landing-tools-stage-glow" />
                  <div className="landing-tools-stage-grid" />
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={activeTool.name}
                      className="landing-tools-single-icon-wrap"
                      aria-hidden="true"
                      initial={{
                        y: toolDirection > 0 ? 70 : -70,
                        scale: 0.62,
                        rotate: toolDirection > 0 ? 10 : -10,
                        opacity: 0.01,
                      }}
                      animate={{
                        y: 0,
                        scale: 1,
                        rotate: 0,
                        opacity: 1,
                      }}
                      exit={{
                        y: toolDirection > 0 ? -50 : 50,
                        scale: 0.7,
                        rotate: toolDirection > 0 ? -8 : 8,
                        opacity: 0.01,
                      }}
                      transition={{
                        y: {
                          type: "spring",
                          stiffness: 520,
                          damping: 30,
                          mass: 0.62,
                        },
                        scale: {
                          type: "spring",
                          stiffness: 560,
                          damping: 24,
                          mass: 0.52,
                        },
                        rotate: {
                          type: "spring",
                          stiffness: 540,
                          damping: 28,
                          mass: 0.58,
                        },
                        opacity: {
                          duration: 0.08,
                          ease: "linear",
                        },
                      }}
                    >
                      <HugeiconsIcon
                        icon={activeTool.icon}
                        size={230}
                        strokeWidth={1.7}
                        className="landing-tools-single-icon"
                        style={{ color: activeTool.accent }}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="landing-tools-copy">
                <div className="landing-tools-list">
                  {essentialTools.map((tool, index) => (
                    <article
                      key={tool.name}
                      className={`landing-tools-item ${index === activeToolIndex ? "is-active" : ""}`}
                    >
                      <span className="landing-tools-count">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3>{tool.name}</h3>
                        <p>{tool.note}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <NewCanvasDialog
        open={newCanvasOpen}
        onClose={() => setNewCanvasOpen(false)}
      />
    </main>
  );
}
