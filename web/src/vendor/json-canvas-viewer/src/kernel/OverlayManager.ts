import type { BaseOptions } from '$';
import type { BaseArgs } from '$/BaseModule';
import type { NodeItem } from '$/DataManager';
import type { WithBorderWidth as Color } from '$/StyleManager';
import type { Hook } from '$/utilities';
import type {
	JSONCanvasFileNode,
	JSONCanvasLinkNode,
	JSONCanvasNode,
	JSONCanvasTextNode,
	Parser,
} from '@repo/shared';
import { BaseModule } from '$/BaseModule';
import Controller from '$/Controller';
import DataManager from '$/DataManager';
import InteractionHandler from '$/InteractionHandler';
import StyleManager from '$/StyleManager';
import { destroyError, hook } from '$/utilities';

type Options = {
	parser?: Parser;
	nodeComponents?: Partial<ComponentDict>;
} & BaseOptions;

type Augmentation = {
	onNodeActive: OverlayManager['onNodeActive'];
	onNodeLosesActive: OverlayManager['onNodeLosesActive'];
};

type NodeComponentHook<N extends JSONCanvasNode> = (options: {
	container: HTMLDivElement;
	content: string;
	node: N;
	onBeforeUnmount: Hook;
	onActive: Hook;
	onLoseActive: Hook;
}) => void | Promise<void>;

type CreateOverlayArgs =
	| [ComponentNodeMap['text'], string, 'text']
	| [ComponentNodeMap['markdown'], string, 'markdown']
	| [ComponentNodeMap['image'], string, 'image']
	| [ComponentNodeMap['audio'], string, 'audio']
	| [ComponentNodeMap['video'], string, 'video']
	| [ComponentNodeMap['file'], string, 'file']
	| [ComponentNodeMap['link'], string, 'link'];

type ComponentNodeMap = {
	text: JSONCanvasTextNode;
	markdown: JSONCanvasFileNode;
	image: JSONCanvasFileNode;
	audio: JSONCanvasFileNode;
	video: JSONCanvasFileNode;
	file: JSONCanvasFileNode;
	link: JSONCanvasLinkNode;
};

type ComponentDict = {
	[K in keyof ComponentNodeMap]: NodeComponentHook<ComponentNodeMap[K]>;
};

export default class OverlayManager extends BaseModule<Options, Augmentation> {
	private _overlaysLayer?: HTMLDivElement = document.createElement('div');
	private overlays: Record<string, HTMLDivElement> = {}; // { id: node } the overlays in viewport
	private selectedId?: string;
	private aborted = false;
	private eventListeners: Record<string, Array<EventListener | undefined>> = {};
	private wanted = new Set<string>();
	private pending = new Set<string>();
	private readonly DM: DataManager;
	private readonly SM: StyleManager;
	private readonly parse: Parser;
	private readonly componentDict: ComponentDict = {
		audio: ({ container, content }) => {
			const audio = document.createElement('audio');
			audio.className = 'JCV-audio';
			audio.src = content;
			audio.controls = true;
			container.appendChild(audio);
		},
		file: () => {
			// Rendered by the host application through nodeComponents.
		},
		image: ({ container, content }) => {
			const img = document.createElement('img');
			img.className = 'JCV-img';
			img.src = content;
			img.loading = 'lazy';
			container.appendChild(img);
		},
		link: ({ container, content }) => {
			const iframe = document.createElement('iframe');
			iframe.src = content;
			iframe.sandbox = 'allow-scripts allow-same-origin';
			iframe.className = 'JCV-link-iframe';
			iframe.loading = 'lazy';
			container.appendChild(iframe);
		},
		markdown: async ({ container, content }) => {
			container.classList.add('JCV-markdown-content');
			const parsedContentWrapper = document.createElement('div');
			parsedContentWrapper.textContent = 'Loading...';
			parsedContentWrapper.classList.add('JCV-parsed-content-wrapper');
			container.appendChild(parsedContentWrapper);
			let parsedContent: string;
			try {
				const response = await fetch(content);
				const result = await response.text();
				const frontmatterMatch =
					/^---\n(?<frontmatter>[\s\S]*?)\n---\n(?<content>[\s\S]*)$/.exec(result);
				parsedContent = await this.parse(frontmatterMatch?.groups?.content ?? result);
			} catch (error) {
				console.error('[JSON Canvas Viewer] Failed to load markdown:', error);
				parsedContent = 'Failed to load content.';
			}
			parsedContentWrapper.innerHTML = parsedContent;
		},
		text: ({ container, content }) => {
			container.classList.add('JCV-markdown-content');
			const parsedContentWrapper = document.createElement('div');
			parsedContentWrapper.innerHTML = content;
			parsedContentWrapper.classList.add('JCV-parsed-content-wrapper');
			container.appendChild(parsedContentWrapper);
		},
		video: ({ container, content }) => {
			const video = document.createElement('video');
			video.className = 'JCV-video';
			video.src = content;
			video.controls = true;
			container.appendChild(video);
		},
	};

	private get overlaysLayer() {
		if (!this._overlaysLayer) throw destroyError;
		return this._overlaysLayer;
	}

	onInteractionStart = hook();
	onInteractionEnd = hook();
	onNodeActive = hook<[JSONCanvasNode]>();
	onNodeLosesActive = hook<[JSONCanvasNode]>();

	constructor(...args: BaseArgs) {
		super(...args);
		this.parse = this.options.parser ?? ((markdown: string) => markdown);
		this.DM = this.container.get(DataManager);
		this.SM = this.container.get(StyleManager);
		const controller = this.container.get(Controller);
		controller.onRefresh.subscribe(this.updateOverlays);
		this.SM.onChangeTheme.subscribe(this.themeChanged);

		this._overlaysLayer = document.createElement('div');
		this._overlaysLayer.className = 'JCV-overlays';
		this._overlaysLayer.id = 'overlays';
		this.DM.data.container.appendChild(this.overlaysLayer);

		const components = this.options.nodeComponents;
		if (components) Object.assign(this.componentDict, components);

		this.augment({
			onNodeActive: this.onNodeActive,
			onNodeLosesActive: this.onNodeLosesActive,
		});
		this.onStart(this.start);
		this.onRestart(this.restart);
		this.onDispose(this.dispose);
	}

	private readonly start = () => {
		this.container.get(InteractionHandler).onClick.subscribe(this.select);
		this.syncOverlays();
	};

	private readonly restart = () => {
		this.wanted.clear();
		this.pending.clear();
		this.clearOverlays();
		this.syncOverlays();
	};

	private readonly overlayType = (item: NodeItem) => {
		const { ref } = item;
		if (ref.type === 'text') return 'text' as const;
		if (ref.type === 'link') return 'link' as const;
		if (ref.type === 'file') return 'file' as const;
		return null;
	};

	private readonly createNodeOverlay = async (item: NodeItem) => {
		if (!this.overlayType(item)) return;
		const node = item.ref;
		this.pending.add(node.id);
		try {
			if (node.type === 'text') {
				const content = this.options.nodeComponents?.text
					? node.text
					: await this.parse(node.text);
				if (this.aborted || !this.wanted.has(node.id)) return;
				this.createOverlay(node, content, 'text');
				return;
			}
			if (this.aborted || !this.wanted.has(node.id)) return;
			if (node.type === 'link') {
				this.createOverlay(node, node.url, 'link');
				return;
			}
			if (node.type === 'file') {
				this.createOverlay(node, node.file, 'file');
			}
		} finally {
			this.pending.delete(node.id);
		}
	};

	private readonly syncOverlays = () => {
		if (this.aborted) return;
		const { offsetX, offsetY, scale, container, nodeMap } = this.DM.data;
		const width = container.clientWidth;
		const height = container.clientHeight;
		const hasViewport = width > 0 && height > 0;
		const margin = 400 / scale;
		const left = -offsetX / scale - margin;
		const top = -offsetY / scale - margin;
		const right = hasViewport ? left + width / scale + margin * 2 : Infinity;
		const bottom = hasViewport ? top + height / scale + margin * 2 : Infinity;
		const wanted = new Set<string>();
		const candidates: NodeItem[] = [];
		for (const item of Object.values(nodeMap)) {
			if (!this.overlayType(item)) continue;
			const node = item.ref;
			if (hasViewport) {
				if (
					node.x + node.width < left ||
					node.x > right ||
					node.y + node.height < top ||
					node.y > bottom
				) {
					continue;
				}
			}
			wanted.add(node.id);
			candidates.push(item);
		}
		this.wanted = wanted;
		Object.keys(this.overlays).forEach((id) => {
			if (!wanted.has(id)) this.removeOverlay(id);
		});
		for (const item of candidates) {
			const id = item.ref.id;
			if (this.overlays[id] || this.pending.has(id)) continue;
			void this.createNodeOverlay(item);
		}
	};

	private readonly themeChanged = () => {
		Object.values(this.overlays).forEach((overlay) => {
			const node = this.DM.data.nodeMap[overlay.id].ref;
			const color = this.SM.getColor(node.color);
			this.setOverlayColor(overlay, color);
		});
	};

	private readonly select = (id?: string) => {
		const previousId = this.selectedId;
		const previous = previousId ? this.overlays[previousId] : undefined;
		const current = id ? this.overlays[id] : undefined;
		if (previous && previousId) {
			previous.classList.remove('JCV-active');
			const nodeItem = this.DM.data.nodeMap[previousId];
			this.onNodeLosesActive(nodeItem.ref);
			nodeItem.onLoseActive?.();
		}
		if (current && id) {
			current.classList.add('JCV-active');
			this.onInteractionStart();
			const nodeItem = this.DM.data.nodeMap[id];
			this.onNodeActive(nodeItem.ref);
			nodeItem.onActive?.();
		} else this.onInteractionEnd();
		this.selectedId = id;
	};

	private readonly updateOverlays = () => {
		const data = this.DM.data;
		const wrapper = this.overlaysLayer.closest('.canvas-viewer-wrap') as HTMLElement | null;
		const angle = Number.parseFloat(
			wrapper?.style.getPropertyValue('--sb-canvas-rotation') || '0',
		);
		const worldX = Number.parseFloat(
			wrapper?.style.getPropertyValue('--sb-rot-world-x') || '0',
		);
		const worldY = Number.parseFloat(
			wrapper?.style.getPropertyValue('--sb-rot-world-y') || '0',
		);
		const rotation = ` translate(${worldX || 0}px, ${worldY || 0}px) rotate(${angle || 0}deg) translate(${-(worldX || 0)}px, ${-(worldY || 0)}px)`;
		this.overlaysLayer.style.transform = `translate(${data.offsetX}px, ${data.offsetY}px) scale(${data.scale})${rotation}`;
		const order = new Map(
			Object.keys(data.nodeMap).map((id, index) => [id, index + 1]),
		);
		Object.entries(this.overlays).forEach(([id, element]) => {
			const item = data.nodeMap[id];
			if (!item) return;
			const node = item.ref;
			element.style.zIndex = String(order.get(id) ?? 1);
			this.applyNodeTransform(element, node);
		});
		this.syncOverlays();
	};

	private readonly applyNodeTransform = (
		element: HTMLDivElement,
		node: {
			x: number;
			y: number;
			width: number;
			height: number;
			'x-superboard'?: {
				rotation?: number;
				kind?: string;
				contentScale?: number;
			};
		},
	) => {
		element.style.left = `${node.x}px`;
		element.style.top = `${node.y}px`;
		element.style.width = `${node.width}px`;
		element.style.height = `${node.height}px`;
		const extension = node['x-superboard'];
		const rotation = extension?.rotation;
		const scalable =
			extension?.kind === 'text' ||
			extension?.kind === 'markdown' ||
			extension?.kind === 'schedule' ||
			extension?.kind === 'media' ||
			(extension?.contentScale !== undefined && extension?.kind === undefined);
		const contentScale = scalable ? extension?.contentScale ?? 1 : 1;
		element.style.setProperty('--sb-content-scale', String(contentScale));
		element.style.setProperty('--sb-content-width', `${100 / contentScale}%`);
		element.style.setProperty('--sb-content-height', `${100 / contentScale}%`);
		element.style.setProperty('--sb-markdown-font-size', `${16 * contentScale}px`);
		element.style.transformOrigin = 'center center';
		element.style.transform = rotation ? `rotate(${rotation}deg)` : '';
	};

	private readonly createOverlay = (...args: CreateOverlayArgs) => {
		if (this.aborted) return;
		const node = args[0];
		if (!this.wanted.has(node.id)) return;
		let element = this.overlays[node.id];
		if (!element) {
			element = this.constructOverlay(...args);
			if (this.aborted) return;
			element.style.zIndex = String(
				Object.keys(this.DM.data.nodeMap).indexOf(node.id) + 1,
			);
			this.overlaysLayer.appendChild(element);
			this.overlays[node.id] = element;
			this.applyNodeTransform(element, node);
		}
	};

	private readonly constructOverlay = (...args: CreateOverlayArgs) => {
		const node = args[0];
		const overlay = document.createElement('div');
		overlay.classList.add('JCV-overlay-container');
		overlay.id = node.id;
		this.setOverlayColor(overlay, this.SM.getColor(node.color));
		const contentWrapper = document.createElement('div');
		contentWrapper.classList.add('JCV-content');
		overlay.appendChild(contentWrapper);
		const clickLayer = document.createElement('div');
		clickLayer.className = 'JCV-click-layer';
		overlay.appendChild(clickLayer);
		const overlayBorder = document.createElement('div');
		overlayBorder.className = 'JCV-overlay-border';
		overlay.appendChild(overlayBorder);
		const nodeItem = this.DM.data.nodeMap[node.id];

		nodeItem.onActive = hook();
		nodeItem.onLoseActive = hook();
		nodeItem.onBeforeUnmount = hook();

		void this.componentDict[args[2]]({
			container: contentWrapper,
			content: args[1],
			node: args[0] as never,
			onActive: nodeItem.onActive,
			onBeforeUnmount: nodeItem.onBeforeUnmount,
			onLoseActive: nodeItem.onLoseActive,
		});
		const onStart = () => {
			if (node.id === this.selectedId) this.onInteractionStart();
		};
		const onEnd = () => {
			if (node.id === this.selectedId) this.onInteractionEnd();
		};
		overlay.addEventListener('pointerenter', onStart);
		overlay.addEventListener('pointerleave', onEnd);
		overlay.addEventListener('touchstart', onStart);
		overlay.addEventListener('touchend', onEnd);
		this.eventListeners[node.id] = [onStart, onEnd];
		return overlay;
	};

	private readonly setOverlayColor = (overlay: HTMLDivElement, color: Color) => {
		Object.entries(color).forEach(([key, value]) => {
			overlay.style.setProperty(`--overlay-${key}`, value);
		});
	};

	private readonly removeOverlay = (id: string) => {
		const overlay = this.overlays[id];
		if (!overlay) return;
		const item = this.DM.data.nodeMap[id];
		item?.onBeforeUnmount?.();
		if (this.selectedId === id) {
			this.selectedId = undefined;
			if (!this.aborted) {
				this.onInteractionEnd();
				if (item) this.onNodeLosesActive(item.ref);
			}
		}
		if (this.eventListeners[id]) {
			const onStart = this.eventListeners[id][0];
			const onEnd = this.eventListeners[id][1];
			if (!onStart || !onEnd) throw destroyError;
			overlay.removeEventListener('pointerenter', onStart);
			overlay.removeEventListener('pointerleave', onEnd);
			overlay.removeEventListener('touchstart', onStart);
			overlay.removeEventListener('touchend', onEnd);
			this.eventListeners[id][0] = undefined;
			this.eventListeners[id][1] = undefined;
		}
		overlay.remove();
		delete this.overlays[id];
	};

	private readonly clearOverlays = () => {
		Object.keys(this.overlays).forEach((id) => this.removeOverlay(id));
	};

	private readonly dispose = () => {
		this.aborted = true;
		this.clearOverlays();
		this.overlaysLayer.remove();
		this._overlaysLayer = undefined;
	};
}
