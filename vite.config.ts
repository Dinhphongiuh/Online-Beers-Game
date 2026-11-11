import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

/**
 * @pixiv/three-vrm 3.5.x (WebGPU MToon nodes) still imports `transformedNormalView`
 * from three/tsl. three r187 merged it into `normalView` (now the normal-mapped view
 * normal), so rename that import when the library is loaded.
 * Remove once three-vrm ships a release built against three r187+.
 */
function threeVrmTslCompat(): Plugin {
  const fixImports = (code: string) =>
    code.replace(/import\s*\{([^}]*)\}\s*from\s*(["'])three\/tsl\2/g, (statement, specifiers: string) =>
      statement.replace(
        specifiers,
        specifiers
          .split(',')
          .map((specifier) => {
            const name = specifier.trim();
            if (name === 'transformedNormalView') return ' normalView as transformedNormalView';
            if (name.startsWith('transformedNormalView as ')) {
              return ` normalView as ${name.slice('transformedNormalView as '.length)}`;
            }
            return specifier;
          })
          .join(',')
      )
    );
  return {
    name: 'three-vrm-tsl-compat',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@pixiv') || !code.includes('transformedNormalView')) return null;
      return {code: fixImports(code), map: null};
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [threeVrmTslCompat(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      // Served as source so the compat plugin above can rewrite it (the dev
      // dependency pre-bundler does not run Vite plugins).
      exclude: ['@pixiv/three-vrm'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
