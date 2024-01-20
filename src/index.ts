class RailwayMapRenderer {
    private stations:    Array<Station>    = [];
    private connections: Array<Connection> = [];
    private groups:      Array<Group>      = [];

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D | null;

    private mouseState: MouseState = new MouseState();

    private config: RailwayMapRendererConfig = new RailwayMapRendererConfig();
    private view: View = new View();

    private clickStart = {x: 0, y: 0};

    private canvasClickables: Array<CanvasClickable> = new Array;

    constructor(
        canvas: HTMLCanvasElement,
        config?: RailwayMapRendererConfig
    ) {
        this.canvas = canvas;

        if (config) this.setConfig(config);

        this.addEventListeners();

        this.ctx = this.canvas.getContext("2d");
    }

    /**
     * Set configuration of RailwayMapRenderer
     * @param config - The config
     */
    public setConfig(config: RailwayMapRendererConfig) {
        this.config = config;
    }

    public onStationClicked: (event: IStationClickedEvent ) => void = () => {};
    public onConnectionClicked: (event: IConnectionClickedEvent) => void = () => {};

    /**
     * Add event listeners to canvas, for camera movement and interactions
     */
    private addEventListeners() {
        const canvas = this.canvas;
        const view = this.view;
        const mouseState = this.mouseState;
        const clickStart = this.clickStart;
        const renderer = this;
    
        function zoom(by: number) {
            view.scale -= by * view.scale;

            renderer.draw();
        }

        function moveMouse(x: number, y: number) {
            const deltaX = x - mouseState.x;
            const deltaY = y - mouseState.y;

            mouseState.x = x;
            mouseState.y = y;

            if (mouseState.clickDown) {
                view.x -= deltaX / view.scale;
                view.y -= deltaY / view.scale;

                renderer.draw();
            }
        }

        function startClick(x: number, y: number) {
            mouseState.clickDown = true;
        
            mouseState.x = x;
            mouseState.y = y;
        
            clickStart.x = mouseState.x;
            clickStart.y = mouseState.y;
        }
        
        function endClick() {
            mouseState.clickDown = false;
        
            let clicked = false;
        
            if (clickStart.x == mouseState.x && clickStart.y == mouseState.y) renderer.canvasClickables.forEach(c => {
                if (c.contains(mouseState.x,mouseState.y)) {
                    if (!clicked) c.clickEvent();
                    clicked = true;
                }
            });
        }

        // Add event listeners for mouse
        canvas.addEventListener("mousedown", (ev) => {
            startClick(ev.clientX,ev.clientY);
        })

        canvas.addEventListener("mousemove", (ev) => {
            moveMouse(ev.clientX,ev.clientY);
        })

        canvas.addEventListener("mouseup", (ev) => {
            endClick();
        })

        canvas.addEventListener("resize", (ev) => {
            renderer.draw();
        }) 

        // Add event listeners for touchscreen
        canvas.addEventListener("touchstart", (ev) => {
            if (ev.touches.length === 2) {
                mouseState.scaling = true;
            } else {
                startClick(ev.touches[0].clientX,ev.touches[0].clientY);
            }
        })

        canvas.addEventListener("touchmove", (ev) => {
            ev.preventDefault();
        
            if (mouseState.scaling) {
                const dist = Math.hypot(
                    ev.touches[0].clientX - ev.touches[1].clientX,
                    ev.touches[0].clientY - ev.touches[1].clientY);
    
                if (mouseState.touchDist) {
                    const deltaDist = mouseState.touchDist-dist
                    zoom(deltaDist)
                }; 
    
    
                mouseState.touchDist = dist;
            } else moveMouse(ev.touches[0].clientX,ev.touches[0].clientY);
        })

        canvas.addEventListener("touchend", (ev) => {
            endClick();

            mouseState.scaling = false;
            mouseState.touchDist = NaN;
        })

        canvas.addEventListener("wheel", (ev) => {
            ev.preventDefault();

            zoom(ev.deltaY*this.config.scrollSensitivity);
        })
    }

    // Clear canvas with clear style
    private clear() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const canvas = this.canvas;

        ctx.fillStyle = this.config.bgStyle;

        ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    private drawStations() {
        this.stations.forEach(s => {
            this.drawStation(s)
        })
    }

    // Draw a station
    private drawStation(station: Station) {
        const view = this.view;

        let x = station.x;
        let y = station.y;
    
        const name = station.name;
        const label = station.label;
        
        const groups = station.groups.filter(g => g.show);

        const stationGroupsOffset = this.config.stationGroupsOffset;
    
        const stationClicked = () => {this.onStationClicked({
            name: name,
            label: label,
            groups: station.groups,
            x: x,
            y: y
        })};
    
        if (groups.length > 0) {
            this.drawText(x,y+(20/view.scale),this.config.fontSize,name,"#ffffff","center",true)
    
            if (groups.length > 1) this.drawLine(x,y,x+stationGroupsOffset/view.scale*(groups.length-1),y-stationGroupsOffset/view.scale*(groups.length-1),"#fff",15,true);
    
            groups.forEach(g=>{
                
                this.drawCircle(x,y,8,`#${g.color}`,"#ffffff",2,true,true,stationClicked);
    
                x += stationGroupsOffset / view.scale;
                y -= stationGroupsOffset / view.scale;
            })
        } else if (this.config.showStationsWithNoConnections) {
            this.drawText(x,y+(20/view.scale),this.config.fontSize,name,"#ffffff","center",true);
    
            this.drawCircle(x,y,8,`#fff`,"#ffffff",2,true,true,stationClicked);
        }
    }

    /**
     * Draw all shown connections
     */
    private drawConnections() {
        const ctx = this.ctx;
        const connections = this.connections;

        if (!ctx) return;

        ctx.beginPath();
        let curGroupId = connections[0].group.id;
    
        connections.forEach(
            c => {

                if (c.group.id != curGroupId) {
                    curGroupId = c.group.id;
                    ctx.stroke();
                    ctx.beginPath();
                }

                this.drawConnection(c)
            }
            );
        ctx.stroke();
    }

    private drawConnection(connection: Connection) {
        const ctx = this.ctx;

        if (!ctx) return;

        const from = connection.fromStation;
        const to = connection.toStation;
        const groupId = connection.group.id;
        const groupName = connection.group.name;
        const view = this.view;

        // Set positions
        let [x, y ] = [from.x, from.y];
        let [x2,y2] = [to.x,   to.y  ];

        const color = connection.group.color;
        const twoWay = connection.twoWay;

        // Get all visible groups 
        const visibleGroups = this.groups.filter(g => g.show)

        // Don't do anything if group of connection isn't visible
        if (!visibleGroups.some(g => g.id == groupId)) return;

        const fromGroups = from.groups?.filter(g => visibleGroups.includes(g));
        const toGroups   = to.  groups?.filter(g => visibleGroups.includes(g));

        // Yup
        if (!(fromGroups && toGroups)) return;

        // Offsets
        const offsetFrom = fromGroups.findIndex(g => g.id == groupId) * this.config.stationGroupsOffset / view.scale;
        const offsetTo   = toGroups  .findIndex(g => g.id == groupId) * this.config.stationGroupsOffset / view.scale;

        x += offsetFrom;
        y -= offsetFrom;
        x2 += offsetTo ;
        y2 -= offsetTo ;

        ctx.strokeStyle = `#${color}`;
        
        const clickConnection = () => {this.onConnectionClicked({
            from_name: from.name,
            from_label: from.label,
            to_name: to.name,
            to_label: to.label,
            group: {
                id: groupId,
                name: groupName,
                color: color
            },
            twoWay: twoWay
        })}

        const lineWidth = this.config.lineWidth;
        const lineWidthHalf = lineWidth / 2;

        this.drawLine(x,y,x,
            y2 + (y < y2 ? lineWidthHalf/view.scale : -lineWidthHalf/view.scale)
            ,`${color}`,lineWidth,false,clickConnection)
        this.drawLine(
            x + (x > x2 ?  lineWidthHalf/view.scale : -lineWidthHalf/view.scale)
            ,y2,x2,y2,`${color}`,lineWidth,false,clickConnection)
    }

    private drawCircle(x: number, y: number, r: number, fillStyle: string, strokeStyle: string, lineWidth: number, constantR: boolean, doStroke:boolean , clickEvent?: () => void) {
        const canvas = this.canvas;
        const view = this.view;
        const ctx = this.ctx;

        if (!ctx) return;

        const X = (x-view.x)*view.scale+(canvas.width/2);
        const Y = (y-view.y)*view.scale+(canvas.height/2);
        const R = constantR ? r : r*view.scale;
    
        if (X+R < 0 || X-R > canvas.width) return;
        if (Y+R < 0 || Y-R > canvas.height) return;
    
        const minX = Math.min(X-(R+lineWidth),X+(R+lineWidth));
        const maxX = Math.max(X-(R+lineWidth),X+(R+lineWidth));
        const minY = Math.min(Y-(R+lineWidth),Y+(R+lineWidth));
        const maxY = Math.max(Y-(R+lineWidth),Y+(R+lineWidth));
    
        if (clickEvent) this.canvasClickables.push(new CanvasClickable(minX,minY,maxX,maxY,clickEvent))
        
        ctx.fillStyle = fillStyle;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        if (doStroke) ctx.beginPath();
        ctx.arc(X, Y, R, 0, 2 * Math.PI, false);
        ctx.fill();
        if (doStroke) ctx.stroke();
    }

    private drawText(x: number, y: number, s: number, text: string, fillStyle:string, textAlign:CanvasTextAlign, constantS:boolean) {
        const canvas = this.canvas;
        const view = this.view;
        const ctx = this.ctx;

        if (!ctx) return;

        const X = (x-view.x)*view.scale+(canvas.width/2);
        const Y = (y-view.y)*view.scale+(canvas.height/2);
        const S = constantS ? s : s*view.scale;
    
        const R = 50;
    
        if (X+R < 0 || X-R > canvas.width) return;
        if (Y+R < 0 || Y-R > canvas.height) return;
        
        ctx.fillStyle = fillStyle;
        ctx.textAlign = textAlign;
        ctx.font = `${s}px ${this.config.font}`;
        ctx.fillText(text,X,Y);
    }

    private drawLine(x:number, y:number, x2:number, y2:number, strokeStyle: string, lineWidth: number, doStroke: boolean, clickEvent?: () => void) {
        const view = this.view;
        const canvas = this.canvas;
        const ctx = this.ctx;

        if (!ctx) return;


        const X =  (x -view.x)*view.scale+(canvas.width /2);
        const Y =  (y -view.y)*view.scale+(canvas.height/2);
        const X2 = (x2-view.x)*view.scale+(canvas.width /2);
        const Y2 = (y2-view.y)*view.scale+(canvas.height/2);
    
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth =   lineWidth;
    
    
        if ((X < 0 && X2 < 0) || (X > canvas.width && X2 > canvas.width)) return;
        if ((Y < 0 && Y2 < 0) || (Y > canvas.height && Y2 > canvas.height)) return;
    

        // Not perfect, but works.. for now
        // TODO: FIX :D
        const minX = Math.min(X-lineWidth/2,X2+lineWidth/2)
        const maxX = Math.max(X-lineWidth/2,X2+lineWidth/2)
        const minY = Math.min(Y-lineWidth/2,Y2+lineWidth/2)
        const maxY = Math.max(Y-lineWidth/2,Y2+lineWidth/2)
    
        if (clickEvent) this.canvasClickables.push(new CanvasClickable(minX,minY,maxX,maxY,clickEvent));
    
        
        if (doStroke) ctx.beginPath();
        ctx.moveTo(X,Y);
        ctx.lineTo(X2,Y2);
        if (doStroke) ctx.stroke();
    }

    // Draw canvas
    private draw() {
        this.clear(); // Clear the canvas first

        if (!this.ctx) return;

        this.canvasClickables = [];

        this.drawConnections();
        this.drawStations();

        this.canvasClickables.reverse();

        // Debug display
        if (!this.config.renderDebug) return;

        this.ctx.strokeStyle = "#fff";
        this.ctx.lineWidth = 2;

        this.canvasClickables.forEach(c => {
            this.ctx?.strokeRect(c.x,c.y,c.x2-c.x,c.y2-c.y)
        });
    }



    /**
     * Set data loaded from api
     * @param stationsData - Array of the stations
     * @param connectionsData - Array of the connections
     */
    public setData(stationsData: Array<IStation>, connectionsData: Array<IConnection> ) {
        this.stations = [];
        this.connections = [];
        this.groups = [];

        // Load stations
        stationsData.forEach(sd => {
            const label = sd.label;
            const name = sd.name;
            const x = sd.x_position;
            const y = sd.z_position;

            // Don't load station if position data doesn't exist
            if (x && y)

            this.stations.push(new Station(label,name,x,y))
        });

        // Load connections & groups
        connectionsData.forEach(cd => {
            const fromStation = this.stations.filter(
                s => s.label == cd.from_station_label
            )[0];
            const toStation = this.stations.filter(
                s => s.label == cd.to_station_label
            )[0];

            let group: Group;

            // Load group 
            if (this.groups.some(
                g => g.id == cd.group_id
            )) group = this.groups.filter(
                g => g.id == cd.group_id
            )[0]; 
            // If group doesn't already exist, add it to groups
            else {
                const groupId = cd.group_id;
                const groupName = cd.group_name;
                const groupColor = cd.colour;

                group = new Group(groupId,groupName,groupColor);

                this.groups.push(group);
            }

            if (!fromStation.groups.some(g => g.id == group.id)) fromStation.groups.push(group);
            if (!toStation.groups.some(g => g.id == group.id)) toStation.groups.push(group);

            const otherWay = this.connections.filter(c => {
                return c.toStation == fromStation && c.fromStation == toStation && c.group == group;
            })[0]

            if (otherWay) 
                otherWay.twoWay = true;
            else 
                this.connections.push(new Connection(fromStation,toStation,group,false));
        })

        this.connections.sort((c1,c2) => c1.group.id - c2.group.id)

        // Draw canvas
        this.draw();
    }
}

interface IStationClickedEvent {
    name: string;
    label: string;
    groups: Array<IGroup>;
    x: number;
    y: number;
}

interface IConnectionClickedEvent {
    from_name: string;
    from_label: string;
    to_name: string;
    to_label: string;
    group: IGroup;
    twoWay: boolean;
}

interface IGroup {
    id: number;
    name: string;
    color: string;
}

class CanvasClickable {
    x:  number;
    y:  number;
    x2: number;
    y2: number;
    clickEvent: () => void;

    constructor(
        x: number,
        y: number,
        x2: number,
        y2: number,
        clickEvent: () => void
    ) {
        this.x = x;
        this.y = y;
        this.x2 = x2;
        this.y2 = y2;
        this.clickEvent = clickEvent;
    }

    public contains(x: number, y:number) {
        return this.x <= x && x <= this.x2 &&
               this.y <= y && y <= this.y2;
    }
}

class Station {
    label: string;
    name: string;
    x: number;
    y: number;
    show: boolean = true;
    groups: Array<Group> = [];

    constructor(
        label: string,
        name: string,
        x: number,
        y: number,
    ) {
        this.label = label;
        this.name = name;
        this.x = x;
        this.y = y;
    }
}

class Connection {
    fromStation: Station;
    toStation: Station;
    group: Group;
    show: boolean = true;
    twoWay: boolean;

    constructor(
        fromStation: Station,
        toStation: Station,
        group: Group,
        twoWay: boolean
    ) {
        this.fromStation = fromStation;
        this.toStation = toStation;
        this.group = group;
        this.twoWay = twoWay;
    }
}

class Group {
    id: number;
    name: string;
    color: string;
    show: boolean = true;

    constructor(
        id: number,
        name: string,
        color: string
    ) {
        this.id = id;
        this.name = name;
        this.color = color;
    }
}

interface IStation {
    label: string,
    name: string,
    x_position: number,
    z_position: number
}

interface IConnection {
    from_station_label: string,
    to_station_label: string,
    group_id: number,
    group_name: string,
    colour: string
}

class View {
    x: number = 0;
    y: number = 0;
    scale: number = 1;
}

class MouseState {
    x: number = 0;
    y: number = 0;
    clickDown: boolean = false;
    scaling: boolean = false;
    touchDist: number = NaN;
}

class RailwayMapRendererConfig {
    bgStyle: string = "#111";
    fontSize: number = 10;
    fontStyle: string = "#fff";
    font: string = "sans-serif";

    lineWidth: number = 8;
    stationGroupsOffset: number = 12;
    renderDebug: boolean = false;
    showStationsWithNoConnections: boolean = true;
    
    scrollSensitivity: number = .001;
}

// Expose classes globally 
(window as any).RailwayMapRenderer = RailwayMapRenderer;
(window as any).RailwayMapRendererConfig = RailwayMapRendererConfig;