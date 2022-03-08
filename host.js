const player = document.querySelector("#player");
const mount = document.querySelector("#mount");
const preview = document.querySelector("#preview");
const selector =  document.querySelector("#savesList");

const hostPlugins = {};
let sizeON = 0;
let mySave;
let hostPluginId;
// Safari...
const AudioContext =
  window.AudioContext || // Default
  window.webkitAudioContext || // Safari and old versions of Chrome
  false;

var audioContext = new AudioContext();
var mediaElementSource = audioContext.createMediaElementSource(player);

var lastNode = mediaElementSource;

const disconnectAll = () => {
  lastNode = mediaElementSource;
  mount.childNodes.forEach((plugin) => {
    let audioNode = hostPlugins[plugin.getAttribute("data-origin")].node;
    lastNode.disconnect(audioNode);
    lastNode = audioNode;
  });
  lastNode.disconnect(audioContext.destination);

  lastNode = mediaElementSource;
  lastNode.connect(audioContext.destination);
};

const reconnectAll = () => {
  mount.childNodes.forEach((plugin) =>
    connectPlugin(hostPlugins[plugin.getAttribute("data-origin")].node)
  );
};

// Very simple function to connect the plugin audionode to the host
const connectPlugin = (audioNode) => {
  lastNode.disconnect(audioContext.destination);
  lastNode.connect(audioNode);

  audioNode.connect(audioContext.destination);
  lastNode = audioNode;
};

// Very simple function to append the plugin root dom node to the host
const mountPlugin = (domNode) => {
  domNode.draggable = true;
  domNode.ondragstart = (event) => {
    event.target.setAttribute("data-DragStartX", event.x);
  };
  domNode.ondragend = (event) => {
    let origin = event.target;
    let target = document.elementFromPoint(event.x, event.y);
    let parent = target.parentNode;

    if (parent == mount && origin != target) {
      disconnectAll();
      if (origin.getAttribute("data-DragStartX") > event.x) {
        parent.insertBefore(origin, target);
      } else {
        parent.insertBefore(target, origin);
      }
      origin.removeAttribute("data-DragStartX");
      reconnectAll();
    }
  };

  mount.innerHtml = "";
  mount.appendChild(domNode);
};

// Recupere la liste des plugins a charger
function loadPluginsList(hostGroupId) {
  fetch("./plugins.json")
    .then((file) => file.json())
    .then((json) => instanciatePlugins(hostGroupId, json));
}

// Crée les plugins d'apres leurs urls
function instanciatePlugins(hostGroupId, plugins) {
  let imports = plugins.map((el) => import(el.url + "index.js"));
  Promise.all(imports).then((modules) => {
    Promise.all(
      modules.map((el) => el.default.createInstance(hostGroupId, audioContext))
    ).then((instances) => {
      initPlugins(plugins, instances);
    });
  });
}

// Charge les plugins dans l'host
function initPlugins(plugins, instances) {
  let nodes = instances.map((el) => el.audioNode);
  let guis = instances.map((el) => el.createGui());
  Promise.all(guis)
    .then((nodeEl) =>
      nodeEl.forEach((el, index) => {
        hostPlugins[plugins[index].url] = { node: nodes[index], gui: el };
      })
    )
    .then(() => loadThumbnails(plugins));
}

// Charge les thumbnails des urls
function loadThumbnails(plugins) {
  let thumbnails = plugins.map((el) => fetch(el.url + "/descriptor.json"));
  Promise.all(thumbnails).then((res) => {
    Promise.all(res.map((el) => el.json())).then((descriptors) => {
      descriptors.forEach((el, index) =>
        addThumbnail(
          plugins[index].url,
          el.thumbnail || plugins[index].thumbnail
        )
      );
    });
  });
}

function loadAModule(baseURL){
  let plugin = hostPlugins[baseURL];
  if (plugin && !plugin.on) {
      plugin.gui.setAttribute("data-origin", baseURL);
      plugin.on = true;
      plugin.nb = sizeON;
      sizeON++;
    mountPlugin(plugin.gui);
    connectPlugin(plugin.node);
  }
}

// Ajoute une thumbnail dans l'html et ecoute les clicks dessus pour ajouter le plugins
function addThumbnail(baseURL, thumbnail) {
  var img = document.createElement("img");
  img.src = baseURL + thumbnail;
  img.addEventListener(
    "click",
    () => {
      loadAModule(baseURL)
    },
    { passive: false }
  );
  preview.appendChild(img);
}

document.querySelector("#save").addEventListener("click", function () {
  mySave = [];
  let myPromises  = [];
  Object.keys(hostPlugins).forEach( elem => {
    if(hostPlugins[elem]["on"] !== undefined){
      let temp =  hostPlugins[elem]["node"].getState();
      myPromises.push(temp);
      temp.then((res) =>{
        mySave.splice(hostPlugins[elem]["nb"], 0, {url : elem, states : res})
      });
    }
  });
  Promise.all(myPromises).then(() => {
    localStorage.setItem(document.querySelector("#nameSave").value,JSON.stringify(mySave));
    loadSaves();
  });
});



document.querySelector("#load").addEventListener("click", function () {
  let name = document.getElementById("savesList").value;
  mount.innerHTML = "";
  mySave = JSON.parse(localStorage.getItem(name));
  mySave.forEach(elem =>{
   loadAModule(elem["url"]);
   hostPlugins[elem["url"]]["node"].setState(elem["states"])
  });
});

function loadSaves(){
  selector.innerHTML = "<option value=''>--select a save--</option>";
  Object.keys(localStorage).forEach(elem =>{
    let opt = document.createElement('option');
    opt.value = elem;
    opt.innerHTML = elem;
    selector.append(opt);
  });
}

document.querySelector("#delete").addEventListener("click",function () {
  deleteSave(selector.value);
});

function deleteSave(name){
  localStorage.removeItem(name);
  loadSaves();
}

window.onload = () => {
  mediaElementSource.connect(audioContext.destination);

  import(
    "https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/published/freeverbForBrowser/utils/sdk/src/initializeWamHost.js"
  ).then((module) => module.default(audioContext).then((res) => {
    hostPluginId = res[0];
    module.default(audioContext).then((res) => loadPluginsList(res[0]))
  }));
  loadSaves();
  player.onplay = () => {
    audioContext.resume();
  };
};
