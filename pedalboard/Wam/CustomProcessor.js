const getCustomProcessor = (moduleId) => {
  const audioWorkletGlobalScope = globalThis;
  const { registerProcessor } = audioWorkletGlobalScope;

  const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
  const { WamProcessor } = ModuleScope;

  class CustomProcessor extends WamProcessor {
    constructor(options) {
      super(options);
    }

    _initialize() {}

    _process(startSample, endSample, inputs, outputs) {
      const input = inputs[0];
      const output = outputs[0];
      if (input.length > 0) {
        for (let c = 0; c < output.length; c++) {
          const x = input[c];
          const y = output[c];
          let n = startSample;
          while (n < endSample) {
            y[n] = x[n];
            n++;
          }
        }
      }
    }

    /**
     * If we don't already store the informations, we get it from each nodes in the PedalBoard and we give each a
     * unique key with the order of the nodeName and the label. If this._parameterInfo is not empty, for each id passed as parameter we
     * return the information stored in it.
     * @param  {string[]} parameterIdQuery A list a node parameters ids.
     * @returns A object including informations about each parameter id passed as parameters.
     * @author Quentin Beauchet
     */
    async getParameterInfo(...parameterIdQuery) {
      if (parameterIdQuery.length == 0) {
        this._parameterInfo = {};

        var childInfos = await Promise.all(
          this.nodes.map((nodeId) => this.group.processors.get(nodeId).getParameterInfo())
        );

        childInfos.forEach((child, i) => {
          child = JSON.parse(JSON.stringify(child));
          const infos = Object.keys(child);
          const pedalId = this.nodes[i];

          infos.forEach((key) => {
            let info = child[key];
            info.pedalId = pedalId;
            this._parameterInfo[`n°${i} ${info.pedalId} -> ${info.label}`] = info;
          });
        });

        return this._parameterInfo;
      } else {
        return parameterIdQuery.reduce((infos, id) => {
          infos[id] = this._parameterInfo[id];
          return infos;
        }, {});
      }
    }

    /**
     * Returns the parameter values from a node in the PedalBoard.
     * @param {boolean} normalized This parameter is heredited from WamProcessor but it is not used.
     * @param {string} parameterIdQuery The id of the node in the PedalBoard, it was set in getParameterInfo().
     * @returns The parameter values of the node.
     * @author Quentin Beauchet
     */
    async getParameterValues(normalized, parameterIdQuery) {
      let parameter = this._parameterInfo[parameterIdQuery];
      if (parameter) {
        let value = await this.group.processors.get(parameter.pedalId).getParameterValues();
        return {
          [parameterIdQuery]: value[parameter.id],
        };
      }
    }

    async _onMessage(message) {
      const { id, request, content } = message.data;
      if (request == "set/init") {
        let { subGroupId, subGroupKey } = content;
        this.group = audioWorkletGlobalScope.webAudioModules.getGroup(subGroupId, subGroupKey);
      } else if (request == "set/nodes") {
        this.nodes = content.nodes;
      } else if (request == "get/parameterInfo") {
        this.port.postMessage({ id, response: request, content: await this.getParameterInfo(...content.parameterIds) });
      } else if (request == "get/parameterValues") {
        let { normalized, parameterIds } = content;
        this.port.postMessage({
          id,
          response: request,
          content: await this.getParameterValues(normalized, ...parameterIds),
        });
      } else if (request == "add/event") {
        this.scheduleEvents(content.event);
      } else {
        await super._onMessage(message);
      }
    }

    /**
     * When an event is sent to the PedalBoard we propagate it to the wam in his chain.
     * @param  {WamEvent[]} events List of events to propagate to the nodes in the PedalBoard.
     * @author Quentin Beauchet
     */
    scheduleEvents(...events) {
      events.forEach((event) => {
        const { type, data, time } = event;
        const { id, value } = data;
        var param = this._parameterInfo[id];

        this.group.processors.get(param.pedalId).scheduleEvents({
          type,
          time,
          data: { id: param.id, normalized: param.normalized, value },
        });
      });
    }

    clearEvents() {
      for (let node of this.nodes) {
        this.group.processors.get(node).clearEvents();
      }
    }
  }

  try {
    registerProcessor(moduleId, CustomProcessor);
  } catch (error) {
    console.warn(error);
  }

  return CustomProcessor;
};

export default getCustomProcessor;
