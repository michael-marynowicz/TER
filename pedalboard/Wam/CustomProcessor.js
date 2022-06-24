const getCustomProcessor = (moduleId) => {
  const audioWorkletGlobalScope = globalThis;
  const { registerProcessor } = audioWorkletGlobalScope;

  const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
  const { WamProcessor, WamParameterInfo } = ModuleScope;

  class CustomProcessor extends WamProcessor {
    _generateWamParameterInfo() {
      return {
        playing: new WamParameterInfo("playing", {
          type: "boolean",
          label: "Playing",
          defaultValue: 0,
        }),
        timeSigDenominator: new WamParameterInfo("timeSigDenominator", {
          type: "int",
          label: "Time Signature Denominator",
          defaultValue: 4,
          minValue: 1,
          maxValue: 128,
        }),
        timeSigNumerator: new WamParameterInfo("timeSigNumerator", {
          type: "int",
          label: "Time Signature Numerator",
          defaultValue: 4,
          minValue: 1,
          maxValue: 128,
        }),
      };
    }

    _process(startSample, endSample, inputs, outputs) {
      const input = inputs[0];
      const output = outputs[0];
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

  try {
    registerProcessor(moduleId, CustomProcessor);
  } catch (error) {
    console.warn(error);
  }

  return CustomProcessor;
};

export default getCustomProcessor;
