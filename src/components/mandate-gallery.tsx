"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

type GalleryPhoto = {
  src: string;
  alt: string;
  href: string;
  category: string;
};

const GRID_SIZE = 4;
const GRID_GAP = 24;

export function MandateGallery({ photos }: { photos: GalleryPhoto[] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const initialSelection = Math.min(5, Math.max(0, photos.length - 1));
  const [selected, setSelected] = useState(initialSelection);
  const [zoom, setZoom] = useState(0.375);
  const [open, setOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 1180, height: 650 });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateSize = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        return;
      }

      if (open || transitioning || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(event.key)) return;
      event.preventDefault();

      if (event.key === "Enter") {
        setOpen(true);
        return;
      }

      const row = Math.floor(selected / GRID_SIZE);
      const column = selected % GRID_SIZE;
      let nextRow = row;
      let nextColumn = column;
      if (event.key === "ArrowLeft") nextColumn = Math.max(0, column - 1);
      if (event.key === "ArrowRight") nextColumn = Math.min(GRID_SIZE - 1, column + 1);
      if (event.key === "ArrowUp") nextRow = Math.max(0, row - 1);
      if (event.key === "ArrowDown") nextRow = Math.min(GRID_SIZE - 1, row + 1);
      const next = Math.min(nextRow * GRID_SIZE + nextColumn, photos.length - 1);
      if (next !== selected) selectPhoto(next);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, photos.length, selected, transitioning]);

  useEffect(() => {
    document.body.classList.toggle("gallery-is-open", open);
    return () => document.body.classList.remove("gallery-is-open");
  }, [open]);

  function selectPhoto(index: number) {
    if (open || transitioning || index === selected) return;
    setTransitioning(true);
    setSelected(index);
    window.setTimeout(() => setTransitioning(false), 920);
  }

  function stepPhoto(direction: number) {
    if (transitioning || open) return;
    const next = (selected + direction + photos.length) % photos.length;
    selectPhoto(next);
  }

  if (!photos.length) return null;

  const column = selected % GRID_SIZE;
  const row = Math.floor(selected / GRID_SIZE);
  const style = {
    "--gallery-zoom": zoom,
    "--gallery-cell-w": `${stageSize.width}px`,
    "--gallery-cell-h": `${stageSize.height}px`,
    "--gallery-pan-x": `${-column * (stageSize.width + GRID_GAP)}px`,
    "--gallery-pan-y": `${-row * (stageSize.height + GRID_GAP)}px`,
  } as CSSProperties;

  return (
    <section className="section gallery-section" id="galeria">
      <div className="shell gallery-shell">
        <div className="section-heading section-heading--split gallery-heading">
          <div>
            <div className="eyebrow"><span /> Mandato em imagens</div>
            <h2>Momentos que contam <em>nossa história.</em></h2>
          </div>
          <p>Escolha uma foto no mapa e clique na moldura central para entrar na imagem.</p>
        </div>

        <div ref={stageRef} className={`spatial-gallery${open ? " is-open" : ""}${transitioning ? " is-moving" : ""}`} style={style}>
          <div className="spatial-viewport" onTransitionEnd={() => setTransitioning(false)}>
            <div className="spatial-canvas">
              {photos.map((photo, index) => (
                <button
                  className={`spatial-tile${index === selected ? " is-selected" : ""}`}
                  type="button"
                  key={`${photo.src}-${index}`}
                  onClick={() => selectPhoto(index)}
                  aria-label={`Selecionar foto: ${photo.alt}`}
                  aria-current={index === selected ? "true" : undefined}
                >
                  <Image src={photo.src} alt={photo.alt} fill sizes="100vw" draggable={false} />
                </button>
              ))}
            </div>
          </div>

          <button
            className="spatial-focus"
            type="button"
            onClick={() => !transitioning && setOpen((value) => !value)}
            aria-label={open ? "Reduzir imagem" : `Ampliar foto: ${photos[selected].alt}`}
          />

          <div className="spatial-crosshair" aria-hidden="true"><i /><i /><span /></div>

          <button className="spatial-close" type="button" onClick={() => setOpen(false)} aria-label="Fechar imagem">
            <X size={17} /> Fechar
          </button>

          <div className="spatial-caption">
            <small>{photos[selected].category}</small>
            <strong>{photos[selected].alt}</strong>
            <Link href={photos[selected].href}>Ver matéria <ExternalLink size={14} /></Link>
          </div>

          <div className="spatial-map" aria-label="Mapa da galeria">
            {photos.map((photo, index) => (
              <button
                key={`${photo.src}-map-${index}`}
                type="button"
                className={index === selected ? "is-selected" : ""}
                onClick={() => selectPhoto(index)}
                aria-label={`Ir para foto ${index + 1}`}
              />
            ))}
          </div>

          <div className="spatial-zoom">
            <span>.750</span>
            <label htmlFor="spatial-zoom" className="sr-only">Zoom do mapa</label>
            <input
              id="spatial-zoom"
              type="range"
              min="0.3"
              max="0.75"
              value={zoom}
              step="0.025"
              onChange={(event) => setZoom(Number(event.target.value))}
              aria-orientation="vertical"
            />
            <span>.300</span>
            <b>zoom</b>
          </div>

          <button className="spatial-arrow spatial-arrow--prev" type="button" onClick={() => stepPhoto(-1)} aria-label="Foto anterior"><ArrowLeft /></button>
          <button className="spatial-arrow spatial-arrow--next" type="button" onClick={() => stepPhoto(1)} aria-label="Próxima foto"><ArrowRight /></button>
        </div>
      </div>
    </section>
  );
}
