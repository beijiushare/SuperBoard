import type {
	Options,
	JSONCanvasViewerInterface,
	GeneralModuleCtor,
	Hook,
	JSONCanvasTextNode,
	JSONCanvasLinkNode,
	JSONCanvasFileNode,
	JSONCanvasNode,
	JSONCanvas,
} from '../src/index.ts'
import type { CSSProperties, ReactNode } from 'react'
import { JSONCanvasViewer } from '../src/index.ts'
import React, {
	forwardRef,
	useCallback,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { createPortal, flushSync } from 'react-dom';

type ModuleInputCtor = Array<GeneralModuleCtor>;

type TextSlotProps = {
	content: string;
	node: JSONCanvasTextNode;
	onActive: Hook;
	onLoseActive: Hook;
};
type LinkSlotProps = {
	content: string;
	node: JSONCanvasLinkNode;
	onActive: Hook;
	onLoseActive: Hook;
};
type FileSlotProps = {
	content: string;
	node: JSONCanvasFileNode;
	onActive: Hook;
	onLoseActive: Hook;
};

type ViewerHandle<T extends ModuleInputCtor> = {
	viewer?: JSONCanvasViewerInterface<T>;
};

type ViewerProps<T extends ModuleInputCtor = ModuleInputCtor> = {
	modules?: T;
	canvas?: JSONCanvas;
	attachments?: Record<string, string>;
	theme?: 'dark' | 'light';
	options?: Omit<Options<T>, 'container' | 'theme' | 'canvas' | 'nodeComponents' | 'attachments'>;
	text?: (props: TextSlotProps) => ReactNode;
	markdown?: (props: FileSlotProps) => ReactNode;
	file?: (props: FileSlotProps) => ReactNode;
	image?: (props: FileSlotProps) => ReactNode;
	video?: (props: FileSlotProps) => ReactNode;
	audio?: (props: FileSlotProps) => ReactNode;
	link?: (props: LinkSlotProps) => ReactNode;
	prerenderHtml?: string;
	className?: string;
	style?: CSSProperties;
};

type PortalEntry = {
	id: string;
	container: HTMLDivElement;
	element: ReactNode;
	node: JSONCanvasNode;
	onActive: Hook;
	onLoseActive: Hook;
	render: (node: JSONCanvasNode) => ReactNode;
};

function contentOf(node: JSONCanvasNode) {
	if (node.type === 'text') return node.text;
	if (node.type === 'link') return node.url;
	if (node.type === 'file') return node.file;
	return '';
}

const emptyOptions = {} as ViewerProps['options'];

export default forwardRef(
	<T extends ModuleInputCtor>(
		{
			attachments,
			canvas,
			theme,
			modules,
			className,
			style,
			prerenderHtml,
			options = emptyOptions,
			text,
			markdown,
			file,
			image,
			video,
			audio,
			link,
		}: ViewerProps<T>,
		ref: React.ForwardedRef<ViewerHandle<T>>,
	) => {
		const containerRef = useRef<HTMLElement | undefined>(undefined);
		const viewerRef = useRef<JSONCanvasViewerInterface<T> | undefined>(undefined);
		const lastCanvasRef = useRef(canvas);
		const [portalsById, setPortalsById] = useState(() => new Map<string, PortalEntry>());

		const upsertPortal = useCallback((entry: PortalEntry) => {
			flushSync(() => {
				setPortalsById((current) => {
					const next = new Map(current);
					next.set(entry.id, entry);
					return next;
				});
			});
		}, []);

		const removePortalById = useCallback((id: string) => {
			setPortalsById((current) => {
				if (!current.has(id)) return current;
				const next = new Map(current);
				next.delete(id);
				return next;
			});
		}, []);

		useImperativeHandle(
			ref,
			() => ({
				get viewer() {
					return viewerRef.current;
				},
			}),
			[],
		);

		const nodeComponents = useMemo<Options['nodeComponents']>(() => {
			function createNodeFunc<N extends TextSlotProps | FileSlotProps | LinkSlotProps>(
				renderFn: (props: N) => ReactNode,
			) {
				return ({
					container,
					content,
					node,
					onBeforeUnmount,
					onActive,
					onLoseActive,
				}: {
					container: HTMLDivElement;
					content: string;
					node: N['node'];
					onBeforeUnmount: Hook;
					onActive: Hook;
					onLoseActive: Hook;
				}) => {
					const render = (nextNode: JSONCanvasNode) =>
						renderFn({
							content: contentOf(nextNode),
							node: nextNode,
							onActive,
							onLoseActive,
						} as N);
					upsertPortal({
						id: node.id,
						container,
						element: renderFn({
							content,
							node,
							onActive,
							onLoseActive,
						} as N),
						node,
						onActive,
						onLoseActive,
						render,
					});
					onBeforeUnmount.subscribe(() => {
						removePortalById(node.id);
					});
				};
			}

			const out: Options['nodeComponents'] = {};
			if (text) out.text = createNodeFunc<TextSlotProps>(text);
			if (markdown) out.markdown = createNodeFunc<FileSlotProps>(markdown);
			if (file) out.file = createNodeFunc<FileSlotProps>(file);
			if (image) out.image = createNodeFunc<FileSlotProps>(image);
			if (video) out.video = createNodeFunc<FileSlotProps>(video);
			if (audio) out.audio = createNodeFunc<FileSlotProps>(audio);
			if (link) out.link = createNodeFunc<LinkSlotProps>(link);
			return out;
		}, [audio, file, image, link, markdown, removePortalById, text, upsertPortal, video]);

		const syncPortals = useCallback((nextCanvas: JSONCanvas) => {
			const nextNodes = new Map(
				(nextCanvas.nodes ?? []).map((node) => [node.id, node]),
			);
			setPortalsById((current) => {
				let changed = false;
				const next = new Map(current);
				for (const [id, entry] of next) {
					const node = nextNodes.get(id);
					if (!node) {
						next.delete(id);
						changed = true;
						continue;
					}
					if (node === entry.node) continue;
					next.set(id, {
						...entry,
						node,
						element: entry.render(node),
					});
					changed = true;
				}
				return changed ? next : current;
			});
		}, []);

		useLayoutEffect(() => {
			if (!containerRef.current) return;

			const viewer = new JSONCanvasViewer(
				{
					...options,
					attachments,
					canvas,
					container: containerRef.current,
					nodeComponents,
					theme,
				} as Options<T>,
				modules,
			);
			viewerRef.current = viewer;
			lastCanvasRef.current = canvas;

			return () => {
				viewer.dispose();
				viewerRef.current = undefined;
				setPortalsById(new Map());
			};
		}, [attachments, modules, nodeComponents, options, theme]);

		useLayoutEffect(() => {
			if (!viewerRef.current || !canvas || lastCanvasRef.current === canvas) return;
			lastCanvasRef.current = canvas;
			viewerRef.current.updateCanvas(canvas);
			syncPortals(canvas);
		}, [canvas, syncPortals]);

		const portals = [...portalsById.values()].map((p) =>
			createPortal(p.element, p.container, p.id),
		);

		return (
			<>
				<section
					ref={(el) => {
						if (el) containerRef.current = el;
					}}
					className={className}
					style={{
						maxHeight: '100vh',
						maxWidth: '100vw',
						...style,
					}}
					dangerouslySetInnerHTML={prerenderHtml ? { __html: prerenderHtml } : undefined}
					suppressHydrationWarning={Boolean(prerenderHtml)}
				/>
				{portals}
			</>
		);
	},
);
