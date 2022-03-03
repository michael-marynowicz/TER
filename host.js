const player = document.querySelector("#player");
const mount = document.querySelector("#mount");
const preview = document.querySelector("#preview");

const hostPlugins = {};

// Safari...
const AudioContext =
  window.AudioContext || // Default
  window.webkitAudioContext || // Safari and old versions of Chrome
  false;

const audioContext = new AudioContext();
const mediaElementSource = audioContext.createMediaElementSource(player);

// Very simple function to connect the plugin audionode to the host
const connectPlugin = (audioNode) => {
  mediaElementSource.connect(audioNode);
  audioNode.connect(audioContext.destination);
};

// Very simple function to append the plugin root dom node to the host
const mountPlugin = (domNode) => {
  mount.innerHtml = "";
  mount.appendChild(domNode);
};

// Recupere la liste des plugins a charger
function loadPluginsList(hostGroupId) {
  fetch("./plugins.json")
    .then((file) => file.json())
    .then((json) => {
      let urls = json.map((el) => el.url);
      instanciatePlugins(hostGroupId, urls);
    });
}

// Crée les plugins d'apres leurs urls
function instanciatePlugins(hostGroupId, urls) {
  let imports = urls.map((el) => import(el + "index.js"));
  Promise.all(imports).then((modules) => {
    Promise.all(
      modules.map((el) => el.default.createInstance(hostGroupId, audioContext))
    ).then((plugins) => {
      initPlugins(urls, plugins);
    });
  });
}

// Charge les plugins dans l'host
function initPlugins(urls, plugins) {
  let nodes = plugins.map((el) => el.audioNode);
  let guis = plugins.map((el) => el.createGui());
  Promise.all(guis)
    .then((nodeEl) =>
      nodeEl.forEach((el, index) => {
        hostPlugins[urls[index]] = { node: nodes[index], gui: el };
      })
    )
    .then(() => loadThumbnails(urls));
}

// Charge les thumbnails des urls
function loadThumbnails(urls) {
  let thumbnails = urls.map((el) => fetch(el + "/descriptor.json"));
  Promise.all(thumbnails).then((res) => {
    Promise.all(res.map((el) => el.json())).then((descriptors) => {
      descriptors.forEach((el, index) =>
        addThumbnail(urls[index], el.thumbnail)
      );
    });
  });
}

// Ajoute une thumbnail dans l'html et ecoute les clicks dessus pour ajouter le plugins
function addThumbnail(baseURL, thumbnail) {
  var img = document.createElement("img");
  img.src = baseURL + "/" + thumbnail;
  img.addEventListener(
    "click",
    () => {
      let plugin = hostPlugins[baseURL];
      if (plugin && !plugin.on) {
        plugin.on = true;
        mountPlugin(plugin.gui);
        connectPlugin(plugin.node);
      }
    },
    { passive: false }
  );
  preview.appendChild(img);
}

window.onload = () => {
  connectPlugin(audioContext.createGain());

  import(
    "https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/published/freeverbForBrowser/utils/sdk/src/initializeWamHost.js"
  ).then((module) =>
    module.default(audioContext).then((res) => loadPluginsList(res[0]))
  );

  player.onplay = () => {
    audioContext.resume();
  };
};
