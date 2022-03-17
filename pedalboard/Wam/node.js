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
    console.log(this._wamNode.module.pedals[pedalName]);
    this.nodes[id] = { name: pedalName, node: audioNode };
  }
  
  saveNodes(nodes,folder,key){
    let mySave = [];
    let promises = [];
    nodes.forEach((el)=>{
      promises.push(this.nodes[el.id].node.getState());
      mySave.push({"url": this.nodes[el.id].node.module._baseURL })
    })
    Promise.all(promises).then((values) => {
      let index = 0;
      values.forEach((el)=>{
        mySave[index]["state"] = el;
        index++;
        
      });
      if(localStorage.getItem(folder) === null) localStorage.setItem(folder,"{}");
      let jsonTemp = JSON.parse(localStorage.getItem(folder));
      jsonTemp[key] = mySave;
      localStorage.setItem(folder, JSON.stringify(jsonTemp));
    });
  }

  loadSaves(myArr){
    myArr.forEach((element)=>{
      console.log(element)
    });
  }
}
