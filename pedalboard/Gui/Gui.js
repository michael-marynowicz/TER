export default class pedalboardGui extends HTMLElement {
  constructor(plug) {
    super();
    this._plug = plug;
    this._plug.gui = this;

    this._root = this.attachShadow({ mode: "open" });

    this.init();
  }

  // Initlialise the differents elements of the gui
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

  // Load the thumbnails of the plugins
  async loadThumbnails() {
    let pedals = Object.keys(this._plug.pedals);
    let keywords = { all: [] };
    let urls = await Promise.all(
      pedals.map((el) => {
        let pedal = this._plug.pedals[el];
        keywords["all"].push(el);
        pedal.descriptor.keywords.forEach((k) => {
          if (!(k in keywords)) {
            keywords[k] = [];
          }
          keywords[k].push(el);
        });
        let thumbnail = pedal.descriptor.thumbnail;
        if (thumbnail == "") {
          return "../pedalboard/Gui/assets/notfound.jpg";
        }
        return `${pedal.url}${thumbnail}`;
      })
    );

    let preview = document.createElement("div");
    preview.id = "preview";

    let select = document.createElement("select");
    const refreshImages = (select) => {
      let keys = Object.keys(keywords);
      let currentKey = keys[select.selectedIndex];
      this.images.innerHTML = "";
      keywords[currentKey].forEach((el) => {
        this.images.appendChild(this._plug.pedals[el].img);
      });
    };
    select.addEventListener("change", (event) => refreshImages(event.target));

    for (let key of Object.keys(keywords)) {
      let filter = document.createElement("option");
      filter.innerHTML = key;
      select.appendChild(filter);
    }
    preview.appendChild(select);

    this.images = document.createElement("div");
    urls.forEach((el, index) => {
      let img = document.createElement("img");
      img.src = el;
      img.addEventListener("click", () => this._plug.addPedal(pedals[index]), {
        passive: false,
      });
      this._plug.pedals[pedals[index]].img = img;
    });
    preview.appendChild(this.images);

    refreshImages(select);
    return preview;
  }

  // Create the save panel
  async loadSaves() {
    if (window.localStorage["pedalBoardSaves"] == undefined) {
      let file = await fetch("../pedalboard/saves.json");
      let json = await file.json();
      window.localStorage["pedalBoardSaves"] = JSON.stringify(json);
    }
    this.folders = JSON.parse(window.localStorage["pedalBoardSaves"]);

    let keys = Object.keys(this.folders);

    let savesInfos = document.createElement("div");
    savesInfos.id = "savesInfos";

    let folders = this.createFolders(keys);

    this.saves = document.createElement("ul");
    this.saves.id = "saves";

    this.infos = document.createElement("infos");
    this.infos.id = "infos";

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
    savesInfos.appendChild(this.saves);
    savesInfos.appendChild(this.infos);
    return savesInfos;
  }

  // Create a list element modifiable with double click and triggering an event with a single click
  createSaveInput(folder, key) {
    let el = document.createElement("li");

    let text = document.createElement("span");
    text.innerHTML = key;
    text.addEventListener("click", () => this.loadSave(folder, key));
    text.addEventListener("dblclick", () => {
      input.value = text.innerHTML;
      input.placeholder = input.value;
      text.innerHTML = "";
      text.appendChild(input);
      input.focus();
    });
    el.append(text);

    let save = document.createElement("button");
    save.innerHTML = "✔";
    save.addEventListener("click", () => this.updateSave(folder, text));
    el.append(save);

    let remove = document.createElement("button");
    remove.innerHTML = "x";
    remove.addEventListener("click", () => this.deleteSave(folder, key, el));
    el.append(remove);

    let input = document.createElement("input");
    input.addEventListener("keyup", (e) => {
      if (e.key == "Enter") input.blur();
    });
    input.addEventListener("blur", (e) => {
      this.updateSave(folder, e.target);
      text.innerHTML = e.target.value;
    });
    return el;
  }

  // Create the list of folders
  createFolders(keys) {
    let folders = document.createElement("ul");
    folders.id = "folders";

    keys.forEach((key) => {
      let el = document.createElement("li");
      el.innerHTML = key;
      el.addEventListener("click", () => this.showFolder(key));
      folders.appendChild(el);
    });

    return folders;
  }

  // Show content of the folder
  showFolder(folder) {
    this.saves.innerHTML = "";

    //TODO Eviter qu'une save ai le même nom
    let button = document.createElement("button");
    button.innerHTML = "New Save";
    button.addEventListener("click", () => {
      let key = "...";
      this.saves.appendChild(this.createSaveInput(folder, key));
      this.folders[folder][key] = { infos: "new Save" };
      window.localStorage["pedalBoardSaves"] = JSON.stringify(this.folders);
    });
    this.saves.appendChild(button);

    Object.keys(this.folders[folder]).forEach((key) => {
      this.saves.appendChild(this.createSaveInput(folder, key));
    });
  }

  // Load the save to the audioNode au show it's informations
  loadSave(folder, key) {
    this.infos.innerHTML = "";
    this._plug.pedalboardNode.disconnectNodes(this.board.childNodes);
    this.board.innerHTML = "";
    this._plug.loadSave(this.folders[folder][key]);

    let cat = document.createElement("h4");
    cat.innerHTML = `Categorie: ${folder}`;

    let name = document.createElement("h4");
    name.innerHTML = `Name: ${key}`;

    let ul = document.createElement("ul");
    this.folders[folder][key].forEach((node) => {
      let li = document.createElement("li");
      li.innerHTML = node.name;
      ul.appendChild(li);
    });

    this.infos.appendChild(cat);
    this.infos.appendChild(name);
    this.infos.appendChild(ul);
  }

  deleteSave(folder, key, node) {
    delete this.folders[folder][key];
    window.localStorage["pedalBoardSaves"] = JSON.stringify(this.folders);
    this.saves.removeChild(node);
  }

  // Update the content of the save in the folder, the name of the save is given by the element
  updateSave(folder, element) {
    let key;
    if (element.tagName == "input") {
      key = element.value;
      let oldKey = element.placeholder;
      if (key != oldKey) {
        this.folders[folder][key] = this.folders[folder][oldKey];
        delete this.folders[folder][oldKey];
      }
    } else {
      key = element.innerHTML;
    }
    this._plug.pedalboardNode.getState(this.board.childNodes).then((save) => {
      this.folders[folder][key] = save;
      window.localStorage["pedalBoardSaves"] = JSON.stringify(this.folders);
    });
  }

  // Add the plugin to the board
  addPlugin(instance, img, id) {
    instance.createGui().then((gui) => {
      let wrapper = document.createElement("article");
      wrapper.draggable = true;
      wrapper.ondragstart = (event) => {
        event.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
        this.DragStartX = event.x;
      };
      wrapper.ondragend = (event) => {
        let origin = this.getWrapper(event.target);
        let target = this.getWrapper(
          this._root.elementFromPoint(event.x, event.y)
        );
        let parent = target.parentNode;

        if (parent == this.board && origin != target) {
          this._plug.pedalboardNode.disconnectNodes(parent.childNodes);
          if (this.DragStartX > event.x) {
            this.board.insertBefore(origin, target);
          } else {
            this.board.insertBefore(target, origin);
          }
          this._plug.pedalboardNode.connectNodes(parent.childNodes);
        }
      };
      let infos = document.createElement("header");
      infos.innerHTML = instance.name;

      let cross = document.createElement("img");
      cross.src = "./pedalboard/Gui/assets/croix.png";
      cross.addEventListener("click", () => {
        this._plug.pedalboardNode.disconnectNodes(this.board.childNodes);
        this.board.removeChild(wrapper);
        this._plug.pedalboardNode.connectNodes(this.board.childNodes);
      });

      infos.append(cross);

      wrapper.appendChild(infos);
      wrapper.appendChild(gui);
      wrapper.id = id;
      wrapper.classList.add("nodeArticle");
      this._root.getElementById("board").appendChild(wrapper);
    });
  }

  // Return the nodeArticle when selecting child node insted of itself with drag and drop
  getWrapper(element) {
    switch (element.tagName) {
      case "IMG":
        return element.parentNode.parentNode;
      case "ARTICLE":
        return element;
      default:
        return element.parentNode;
    }
  }

  // Link the css
  setStyle() {
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", "../pedalboard/Gui/style.css");

    this._root.appendChild(linkElem);
  }
}

customElements.define("wap-pedalboard", pedalboardGui);
