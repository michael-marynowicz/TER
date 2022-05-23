import "https://preview.babylonjs.com/babylon.js";

/**
 * @param {URL} relativeURL
 * @returns {string}
 */
const getBasetUrl = (relativeURL) => {
  const baseURL = relativeURL.href.substring(0, relativeURL.href.lastIndexOf("/"));
  return baseURL;
};
export default class Visualizer {
  _baseURL = getBasetUrl(new URL(".", import.meta.url));

  constructor(canvas, analyser) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(this.canvas, true);

    analyser.fftSize = 256;
    this.bufferLengthAlt = analyser.frequencyBinCount;
    this.dataArrayAlt = new Uint8Array(this.bufferLengthAlt);

    this.createScene();

    this.resize();

    let c = 0;
    let mean;
    this.engine.runRenderLoop(() => {
      if (this.canvas.on) {
        if (c % 60 == 0) {
          analyser.getByteTimeDomainData(this.dataArrayAlt);
          let arr = Array.from(this.dataArrayAlt);
          mean = arr.reduce((prev, curr) => prev + curr, 0) / arr.length;
        }
        c++;

        if (this.plane?.material) {
          let param = this.plane.material.attachedBlocks[12];
          param._storedValue = this.lerp(param._storedValue, this.map(mean, 0, 256, param.min, param.max), 0.005);
        }
        this.scene.render();
      }
    });
  }

  resize() {
    let resized = false;
    new ResizeObserver(() => {
      resized = true;
    }).observe(this.canvas);

    this.scene.beforeRender = () => {
      if (resized) {
        this.engine.resize();
        resized = false;
      }
    };
  }

  createScene() {
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color3.Black();

    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
    light.intensity = 0.7;

    this.plane = BABYLON.MeshBuilder.CreatePlane("plane", { height: 10, width: 20 });

    BABYLON.NodeMaterial.ParseFromFileAsync("shader", `${this._baseURL}/assets/material.json`, this.scene).then((e) => {
      this.plane.material = e;
    });

    this.camera = new BABYLON.ArcRotateCamera(
      "Camera",
      -Math.PI / 2,
      Math.PI / 2,
      5,
      BABYLON.Vector3.Zero(),
      this.scene
    );
  }

  map = (value, x1, y1, x2, y2) => ((value - x1) * (y2 - x2)) / (y1 - x1) + x2;
  lerp = (start, end, amt) => (1 - amt) * start + amt * end;
}
