import CompositeAudioNode from "https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/published/freeverbForBrowser/utils/sdk-parammgr/src/CompositeAudioNode.js";

export default class PedalBoardNode extends CompositeAudioNode {
  /**
   * @type {ParamMgrNode}
   */
  _wamNode = undefined;

  nodes = {};
  pedalBoardInfos = {};
  lastParameterValue = {};

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

  async getParameterInfo(...parameterIdQuery) {
    if (parameterIdQuery.length == 0) {
      this.pedalBoardInfos = {};
      var pedalNames = {};

      const keys = Object.keys(this.nodes);
      var childInfos = await Promise.all(keys.map((key) => this.nodes[key].node.getParameterInfo()));
      childInfos.forEach((child, i) => {
        const infos = Object.keys(child);
        const pedalName = this.nodes[keys[i]].name;
        pedalNames[pedalName] = pedalNames[pedalName] == undefined ? 0 : pedalNames[pedalName] + 1;

        infos.forEach((key) => {
          let info = child[key];
          info.pedalId = keys[i];
          info.label = `n°${i} ${pedalName} -> ${info.label}`;
          this.pedalBoardInfos[info.label] = info;
        });
      });
      return this.pedalBoardInfos;
    } else {
      let infos = {};
      parameterIdQuery.forEach((id) => {
        infos[id] = this.pedalBoardInfos[id];
      });
      return infos;
    }
  }

  async getParameterValues(normalized, parameterIdQuery) {
    let parameter = this.pedalBoardInfos[parameterIdQuery];
    if (parameter) {
      this.lastParameterValue = await this.nodes[parameter.pedalId].node.getParameterValues();
      return { [parameterIdQuery]: this.lastParameterValue[parameter.id] };
    }
  }

  scheduleEvents(...events) {
    events.forEach((event) => {
      const { type, data, time } = event;
      if (type === "wam-automation") {
        const info = this.pedalBoardInfos[data.id];
        const { id, normalized } = this.lastParameterValue[info.id];
        this.automateChange(this.nodes[info.pedalId].node._wamNode.parameters.get(id), normalized, data.value, time);
      }
    });
    this._wamNode.call("scheduleEvents", ...events);
  }

  automateChange(audioParam, normalized, value, time) {
    if (!audioParam) return;
    if (audioParam.info.type === "float") {
      if (normalized) audioParam.linearRampToNormalizedValueAtTime(value, time);
      else audioParam.linearRampToValueAtTime(value, time);
    } else {
      if (normalized) audioParam.setNormalizedValueAtTime(value, time);
      else audioParam.setValueAtTime(value, time);
    }
  }
}
