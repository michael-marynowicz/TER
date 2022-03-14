export default class pedalboardGui extends HTMLElement {
  constructor(plug) {
    super();
    this._plug = plug;
    this._plug.gui = this;

    this._root = this.attachShadow({ mode: "open" });

    this.init();
  }

  async init() {
    this.setStyle();

    this.preview = await this.loadThumbnails();
    this._root.appendChild(this.preview);

    this.board = document.createElement("div");
    this.board.id = "board";
    this._root.appendChild(this.board);

    this.saveMenu = await this.loadSaves();
    this._root.appendChild(this.saveMenu);
  }

  async loadThumbnails() {
    let pedals = Object.keys(this._plug.pedals);
    let urls = await Promise.all(
      pedals.map((el) => {
        let pedal = this._plug.pedals[el];
        let thumbnail = pedal.descriptor.thumbnail;
        if (thumbnail == "") {
          return "../pedalboard/Gui/assets/notfound.jpg";
        }
        return `${pedal.url}${thumbnail}`;
      })
    );

    let preview = document.createElement("div");
    preview.id = "preview";

    urls.forEach((el, index) => {
      let img = document.createElement("img");
      img.src = el;
      img.addEventListener("click", () => this._plug.addPedal(pedals[index]), {
        passive: false,
      });
      preview.appendChild(img);
    });

    return preview;
  }

  async loadSaves() {
    let file = await fetch("../pedalboard/saves.json");
    this.folders = await file.json();

    let keys = Object.keys(this.folders);

    let savesInfos = document.createElement("div");
    savesInfos.id = "savesInfos";

    let folders = document.createElement("ul");
    folders.id = "folders";
    for (let i = 0; i < 10; i++) {
      let el = document.createElement("li");

      let edit = document.createElement("button");
      edit.innerHTML = "E";
      el.append(edit);

      let remove = document.createElement("button");
      remove.innerHTML = "x";
      el.append(remove);

      if (i < keys.length) {
        let text = document.createElement("span");
        text.innerHTML = keys[i];
        el.append(text);
      }
      folders.appendChild(el);
    }
    let newFolder = document.createElement("button");
    newFolder.innerHTML = "+";
    folders.appendChild(newFolder);

    let saves = document.createElement("ul");
    saves.id = "saves";
    for (let i = 0; i < 10; i++) {
      let el = document.createElement("li");
      if (i == 9) {
        el.id = "newSave";
      }
      saves.appendChild(el);
    }

    let infos = document.createElement("infos");
    infos.id = "infos";

    let foldersTitle = document.createElement("h1");
    foldersTitle.innerHTML = "Categories";
    let savesTitle = document.createElement("h1");
    savesTitle.innerHTML = "Saves";
    let infosTitle = document.createElement("h1");
    infosTitle.innerHTML = "Information";

    savesInfos.appendChild(foldersTitle);
    savesInfos.appendChild(savesTitle);
    savesInfos.appendChild(infosTitle);
    savesInfos.appendChild(folders);
    savesInfos.appendChild(saves);
    savesInfos.appendChild(infos);
    return savesInfos;
  }

  addPlugin(instance, id) {
    instance.createGui().then((gui) => {
      gui.draggable = true;
      gui.ondragstart = (event) => {
        this.DragStartX = event.x;
      };
      gui.ondragend = (event) => {
        let origin = event.target;
        let target = this._root.elementFromPoint(event.x, event.y);
        let parent = target.parentNode;

        if (parent == this.board && origin != target) {
          this._plug.pedalboardNode.disconnectNodes(parent.childNodes);
          if (this.DragStartX > event.x) {
            parent.insertBefore(origin, target);
          } else {
            parent.insertBefore(target, origin);
          }
          this._plug.pedalboardNode.connectNodes(parent.childNodes);
        }
      };
      gui.id = id;
      this._root.getElementById("board").appendChild(gui);
    });
  }

  setStyle() {
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", "../pedalboard/Gui/style.css");

    this._root.appendChild(linkElem);
  }
}

customElements.define("wap-pedalboard", pedalboardGui);
