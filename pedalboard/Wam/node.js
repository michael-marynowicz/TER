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
    var connectedIds = [];
    nodes.forEach((el) => {
      let audioNode = this.nodes[el.id].node;
      this.lastNode.connect(audioNode);
      this.lastNode = audioNode;
      connectedIds.push(el.id);
    });
    Object.keys(this.nodes).forEach((el) => {
      if (!connectedIds.includes(el)) delete this.nodes[el];
    });

    this.lastNode.connect(this._output);
    this.updateInfos();
  }

  disconnectNodes(nodes) {
    this.lastNode = this._input;
    nodes.forEach((el) => {
      let audioNode = this.nodes[el.id].node;
      this.lastNode.disconnect(audioNode);
      this.lastNode = audioNode;
    });
    this.lastNode.disconnect(this._output);
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
    this.updateInfos();
  }

  async getState(nodes) {
    let ids = Array.from(nodes).map((el) => el.id);
    let states = await Promise.all(ids.map((id) => this.nodes[id].node.getState()));

    return states.map((el, index) => ({
      name: this.nodes[ids[index]].name,
      state: el,
    }));
  }

  updateInfos() {
    this._wamNode.dispatchEvent(
      new CustomEvent("wam-info", {
        detail: { data: this },
      })
    );
  }

  async getParameterInfo() {
    var pedalBoardInfos = {};
    var pedalNames = {};
    var id = 0;

    const keys = Object.keys(this.nodes);
    var childInfos = await Promise.all(keys.map((key) => this.nodes[key].node.getParameterInfo()));
    childInfos.forEach((child, i) => {
      const infos = Object.keys(child);
      const pedalName = this.nodes[keys[i]].name;
      if (pedalNames[pedalName] != undefined) {
        pedalNames[pedalName] += 1;
      } else {
        pedalNames[pedalName] = 0;
      }

      infos.forEach((key) => {
        let info = child[key];
        info.id = id;
        id += 1;
        info.label = `n°${i} ${pedalName} -> ${info.label}`;
        pedalBoardInfos[info.label] = info;
      });
    });
    return pedalBoardInfos;
  }
}
