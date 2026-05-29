import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Thin GLTFLoader wrapper returning Promises. Models live in /public/models and
 * are served at the site root (e.g. 'models/capybara-rigged.glb').
 */
export class AssetLoader {
  constructor() {
    this.loader = new GLTFLoader();
  }

  load(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(url, resolve, undefined, reject);
    });
  }
}
