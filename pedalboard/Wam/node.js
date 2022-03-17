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
    this.connectNodes([]);
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

  connectNodes(nodes) {
    this.lastNode = this._input;
    nodes.forEach((el) => {
      let audioNode = this.nodes[el.id].node;
      this.lastNode.connect(audioNode);
      this.lastNode = audioNode;
    });
    this.lastNode.connect(this._output);
  }

  disconnectNodes(nodes) {
    this.lastNode = this._input;
    nodes.forEach((el) => {
      let audioNode = this.nodes[el.id].node;
      this.lastNode.disconnect(audioNode);
      this.lastNode = audioNode;
    });
    this.lastNode.disconnect(this._output);
    this.connectNodes([]);
  }

  connectPlugin(audioNode) {
    this.lastNode.disconnect(this._output);
    this.lastNode.connect(audioNode);

    audioNode.connect(this._output);
    this.lastNode = audioNode;
  }

  addPlugin(audioNode, pedalName, id) {
    this.connectPlugin(audioNode);
    this.nodes[id] = { name: pedalName, node: audioNode };
  }

  async getState(nodes) {
    let ids = Array.from(nodes).map((el) => el.id);
    let states = await Promise.all(
      ids.map((id) => this.nodes[id].node.getState())
    );

    return states.map((el, index) => ({
      name: this.nodes[ids[index]].name,
      state: el,
    }));
  }
}
