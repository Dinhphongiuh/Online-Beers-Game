/**
 * 3D beer renders for the UI: `BeerRender` shows a cached still (falls back to the
 * SVG drawing until it is ready, or if WebGL is unavailable); `BeerViewer` is a live
 * turntable you can drag to spin.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Beer } from '../../game/beerCatalog';
import { createBeerModel, createBeerStudio, disposeBeerModel, renderBeerThumbnail } from '../../game/beerModels';
import { BeerArt } from './BeerArt';

export const BeerRender: React.FC<{ beer: Beer; className?: string }> = ({ beer, className }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Let the page paint first; each still takes a few ms to render.
    const handle = window.setTimeout(() => {
      try {
        const rendered = renderBeerThumbnail(beer, 480, 360);
        if (!cancelled) setUrl(rendered);
      } catch (error) {
        console.warn('[beer render] falling back to the drawing', error);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [beer]);
  if (!url) return <BeerArt beer={beer} className={className} />;
  return <img src={url} alt={beer.name} draggable={false} className={`${className ?? ''} object-cover`} data-testid={`beer-render-${beer.id}`} />;
};

export const BeerViewer: React.FC<{ beer: Beer; className?: string }> = ({ beer, className }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const studio = createBeerStudio(renderer);
    const camera = new THREE.PerspectiveCamera(24, mount.clientWidth / mount.clientHeight, 0.1, 500);
    const model = createBeerModel(beer, true);
    studio.stage(model, camera);
    const target = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.2;
    controls.minPolarAngle = Math.PI * 0.3;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.update();

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      controls.update();
      model.userData.update?.(clock.getElapsedTime());
      renderer.render(studio.scene, camera);
    });
    const observer = new ResizeObserver(() => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    });
    observer.observe(mount);
    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      disposeBeerModel(model);
      studio.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [beer]);

  if (failed) return <BeerArt beer={beer} className={className} />;
  return <div ref={mountRef} className={`${className ?? ''} cursor-grab active:cursor-grabbing`} data-testid="beer-viewer" title="Kéo để xoay" />;
};
