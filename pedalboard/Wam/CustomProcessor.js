const getCustomProcessor = (moduleId) => {
  const audioWorkletGlobalScope = globalThis;
  const { registerProcessor, webAudioModules } = audioWorkletGlobalScope;

  const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
  const { WamProcessor, WamParameterInfo } = ModuleScope;

  console.log(audioWorkletGlobalScope.webAudioModules, ModuleScope);

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

    async getParameterInfo(...parameterIdQuery) {
      if (parameterIdQuery.length == 0) {
        this._parameterInfo = {};

        var pedalNames = {};
        var childInfos = await Promise.all(
          this.nodes.map((nodeId) => this.group.processors.get(nodeId).getParameterInfo())
        );
        childInfos.forEach((child, i) => {
          const infos = Object.keys(child);
          const pedalName = this.nodes[i];
          pedalNames[pedalName] = pedalNames[pedalName] == undefined ? 0 : pedalNames[pedalName] + 1;

          infos.forEach((key) => {
            let info = child[key];
            info.pedalId = this.nodes[i];
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
        let { subGroupId, subGroupKey, destinationId } = content;
        this.group = audioWorkletGlobalScope.webAudioModules.getGroup(subGroupId, subGroupKey);

        this.destProcessor = this.group.processors.get(destinationId);
        this.destProcessor.onScheduleEvents = (...events) => this.selfEmitEvents(...events);
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

    selfEmitEvents(...events) {
      webAudioModules.emitEvents(this, ...events);
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
