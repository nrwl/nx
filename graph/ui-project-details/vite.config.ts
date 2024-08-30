import { defineConfig } from "vite";
import {nxViteTsPaths} from "@nx/vite/plugins/nx-tsconfig-paths.plugin";
import react from '@vitejs/plugin-react'

export default defineConfig({
  define: {
    'process': {
      env: {}
    }
  },
  plugins: [
    nxViteTsPaths(),
    react()
  ],

  build: {

    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: 'src/lib/project-details/project-details.tsx',
      name: 'PDV',
      // the proper extensions will be added
      fileName: 'pdv',
      formats: ['umd'],

    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React', // Global variable for the external dependency
 'react-dom': 'ReactDOM' // Global variable for the external dependency
        }
      }
    },
  
  },
  
});