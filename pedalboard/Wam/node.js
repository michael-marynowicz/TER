import CompositeAudioNode from "https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/published/freeverbForBrowser/utils/sdk-parammgr/src/CompositeAudioNode.js";

export default class PedalBoardNode extends CompositeAudioNode {
  /**
   * @type {ParamMgrNode}
   */
  _wamNode = undefined;

  nodes = {};

  /**
   * @param {ParamMgrNode} wamNode
   */
  setup(wamNode) {
    this._wamNode = wamNode;
    this.lastNode = this._input;
    this.connectNodes();
  }

  constructor(context, options) {
    super(context, options);
    this.createNodes();
  }

  createNodes() {
    this._input = this.context.createGain();
    this.connect(this._input);
    this._output = this.context.createGain();
  }

  connectNodes() {
    this._input.connect(this._output);
  }

  disconnectAll(nodes) {
    this.lastNode = this._input;
    nodes.forEach((el) => {
      let audioNode = this.nodes[el.id];
      this.lastNode.disconnect(audioNode);
      this.lastNode = audioNode;
    });
    this.lastNode.disconnect(this._output);

    this.lastNode = this._input;
    this.lastNode.connect(this._output);
  }

  reconnectAll(nodes) {
    nodes.forEach((el) => this.connectPlugin(this.nodes[el.id]));
  }

  connectPlugin(audioNode) {
    this.lastNode.disconnect(this._output);
    this.lastNode.connect(audioNode);

    audioNode.connect(this._output);
    this.lastNode = audioNode;
  }

  addPlugin(audioNode, id) {
    this.connectPlugin(audioNode);
    this.nodes[id] = audioNode;
  }
}
