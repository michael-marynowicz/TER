export default class Visualizer {
  constructor(canvas, analyser) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(this.canvas, true);

    analyser.fftSize = 256;
    this.bufferLengthAlt = analyser.frequencyBinCount;
    this.dataArrayAlt = new Uint8Array(this.bufferLengthAlt);

    this.scene = this.createScene();

    this.resize();

    this.engine.runRenderLoop(() => {
      //analyser.getByteTimeDomainData(this.dataArrayAlt);

      this.scene.render();
    });
  }

  resize() {
    let { width, height } = this.canvas.getBoundingClientRect();
    this.width = width;
    this.height = height;
    this.scene.beforeRender = () => {
      let { width, height } = this.canvas.getBoundingClientRect();
      if (this.width != width || this.height != height) {
        let ratio = this.width / width;

        this.width = width;
        this.height = height;

        if (ratio != 0) {
          this.plane.scaling.x /= ratio;
          this.plane.scaling.y /= ratio;
        }

        this.engine.resize();
      }
    };
  }

  createScene() {
    var scene = new BABYLON.Scene(this.engine);

    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    this.plane = BABYLON.MeshBuilder.CreatePlane(
      "plane",
      { width: this.canvas.width, height: this.canvas.height },
      scene
    );
    BABYLON.NodeMaterial.ParseFromFileAsync("shader", "/pedalboard/Gui/assets/material.json", scene).then((e) => {
      this.plane.material = e;
    });

    this.camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI / 2, Math.PI / 2, 5, BABYLON.Vector3.Zero(), scene);
    this.camera.radius = this.canvas.width;

    return scene;
  }

  map = (value, x1, y1, x2, y2) => ((value - x1) * (y2 - x2)) / (y1 - x1) + x2;
}
