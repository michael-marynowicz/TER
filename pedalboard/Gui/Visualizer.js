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
      analyser.getByteTimeDomainData(this.dataArrayAlt);
      let width = this.width / this.bufferLengthAlt;
      for (let i = 0; i < this.bufferLengthAlt; i++) {
        let height = (128 - this.dataArrayAlt[i]) * 2;
        this.boxes[i].scaling = new BABYLON.Vector3(width, height, 1);
        this.boxes[i].position.x = i * width;
      }

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
        this.width = width;
        this.height = height;

        this.engine.resize();
      }
    };
  }

  createScene() {
    var scene = new BABYLON.Scene(this.engine);
    scene.clearColor = new BABYLON.Color3(1, 1, 1);

    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    const color1 = new BABYLON.Color3(0, 0, 1);
    const color2 = new BABYLON.Color3(1, 0, 0);

    this.boxes = [];
    for (let i = 0; i < this.bufferLengthAlt; i++) {
      let box = new BABYLON.MeshBuilder.CreateBox(`${i}`);
      /*
      box.enableEdgesRendering();
      box.edgesWidth = 10.0;
      box.edgesColor = new BABYLON.Color4(0, 0, 0, 1);*/

      const mat = new BABYLON.StandardMaterial("mat" + i, scene);
      mat.diffuseColor = BABYLON.Color3.Lerp(color1, color2, i / (this.bufferLengthAlt - 1));
      box.material = mat;

      this.boxes.push(box);
    }

    this.camera = new BABYLON.FollowCamera("camera1", new BABYLON.Vector3.Zero(), scene);
    this.camera.lockedTarget = this.boxes[this.bufferLengthAlt / 2];
    this.camera.radius = 305;

    return scene;
  }
}
