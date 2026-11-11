import { TYPE_COLORS } from "#/components/type-badge";
import type { HallOfFameMember } from "#/db/schema";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 840;

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const GOLD = "#f5c542";
const GOLD_DIM = "#b8902a";
const TEXT = "#f4f1e8";
const MUTED = "#a9b0c8";

export type CardInfo = {
	runName: string;
	gameName: string;
	inductedAt: Date;
	battlesWon: number;
	deaths: number;
	members: HallOfFameMember[];
};

function loadImage(src: string) {
	return new Promise<HTMLImageElement | null>((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = src;
	});
}

/** Shrinks the font until the text fits, then draws it centred at x. */
function fitText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
	size: number,
	weight: number,
	color: string,
) {
	let s = size;
	ctx.font = `${weight} ${s}px ${FONT}`;
	while (s > 10 && ctx.measureText(text).width > maxWidth) {
		s -= 1;
		ctx.font = `${weight} ${s}px ${FONT}`;
	}
	ctx.fillStyle = color;
	ctx.fillText(text, x, y);
}

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}

function drawStar(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
) {
	ctx.beginPath();
	for (let i = 0; i < 10; i++) {
		const radius = i % 2 === 0 ? r : r * 0.45;
		const a = (Math.PI / 5) * i - Math.PI / 2;
		ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
	}
	ctx.closePath();
	ctx.fill();
}

/** Seeded so the sparkles land in the same place every time a card is drawn. */
function rng(seed: number) {
	let s = seed || 1;
	return () => {
		s = (s * 16807) % 2147483647;
		return s / 2147483647;
	};
}

function drawBackground(ctx: CanvasRenderingContext2D, seed: number) {
	const bg = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
	bg.addColorStop(0, "#151a3a");
	bg.addColorStop(1, "#0a0c1c");
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

	// spotlight behind the title
	const glow = ctx.createRadialGradient(
		CARD_WIDTH / 2,
		40,
		0,
		CARD_WIDTH / 2,
		40,
		620,
	);
	glow.addColorStop(0, "rgba(245, 197, 66, 0.28)");
	glow.addColorStop(1, "rgba(245, 197, 66, 0)");
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

	const rand = rng(seed);
	for (let i = 0; i < 70; i++) {
		const alpha = 0.15 + rand() * 0.5;
		const x = rand() * CARD_WIDTH;
		const y = rand() * CARD_HEIGHT;
		const r = 1 + rand() * 3;
		// keep clear of the title, subtitle and footer text
		const onText =
			Math.abs(x - CARD_WIDTH / 2) < 440 &&
			((y > 45 && y < 165) || y > CARD_HEIGHT - 75);
		if (onText) continue;
		ctx.fillStyle = `rgba(255, 240, 200, ${alpha})`;
		drawStar(ctx, x, y, r);
	}

	// gold frame
	ctx.strokeStyle = GOLD_DIM;
	ctx.lineWidth = 3;
	roundRect(ctx, 16, 16, CARD_WIDTH - 32, CARD_HEIGHT - 32, 22);
	ctx.stroke();
	ctx.strokeStyle = "rgba(245, 197, 66, 0.35)";
	ctx.lineWidth = 1;
	roundRect(ctx, 26, 26, CARD_WIDTH - 52, CARD_HEIGHT - 52, 16);
	ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D, info: CardInfo) {
	ctx.textAlign = "center";
	ctx.textBaseline = "alphabetic";

	const title = ctx.createLinearGradient(0, 60, 0, 112);
	title.addColorStop(0, "#fff1b8");
	title.addColorStop(1, GOLD);
	ctx.font = `800 56px ${FONT}`;
	ctx.letterSpacing = "10px";
	ctx.shadowColor = "rgba(245, 197, 66, 0.6)";
	ctx.shadowBlur = 24;
	ctx.fillStyle = title;
	ctx.fillText("HALL OF FAME", CARD_WIDTH / 2 + 5, 108);
	ctx.shadowBlur = 0;
	ctx.letterSpacing = "0px";

	ctx.fillStyle = GOLD;
	drawStar(ctx, CARD_WIDTH / 2 - 270, 90, 12);
	drawStar(ctx, CARD_WIDTH / 2 + 270, 90, 12);

	fitText(
		ctx,
		`${info.runName}  ·  ${info.gameName}`,
		CARD_WIDTH / 2,
		150,
		CARD_WIDTH - 160,
		26,
		600,
		TEXT,
	);
}

function drawMember(
	ctx: CanvasRenderingContext2D,
	m: HallOfFameMember,
	img: HTMLImageElement | null,
	x: number,
	y: number,
	w: number,
	h: number,
) {
	const cx = x + w / 2;

	const panel = ctx.createLinearGradient(0, y, 0, y + h);
	panel.addColorStop(0, "rgba(255, 255, 255, 0.09)");
	panel.addColorStop(1, "rgba(255, 255, 255, 0.03)");
	ctx.fillStyle = panel;
	roundRect(ctx, x, y, w, h, 18);
	ctx.fill();
	ctx.strokeStyle = "rgba(245, 197, 66, 0.3)";
	ctx.lineWidth = 1.5;
	ctx.stroke();

	// pedestal glow under the sprite
	const pedestal = ctx.createRadialGradient(cx, y + 128, 0, cx, y + 128, 80);
	pedestal.addColorStop(0, "rgba(245, 197, 66, 0.3)");
	pedestal.addColorStop(1, "rgba(245, 197, 66, 0)");
	ctx.fillStyle = pedestal;
	ctx.beginPath();
	ctx.ellipse(cx, y + 128, 80, 18, 0, 0, Math.PI * 2);
	ctx.fill();

	if (img) {
		// 96px sprites at an exact 2x stay crisp
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(img, cx - 72, y - 2, 144, 144);
		ctx.imageSmoothingEnabled = true;
	}

	const name = m.nickname || m.speciesName || "???";
	fitText(ctx, name, cx, y + 182, w - 32, 28, 700, TEXT);
	if (m.nickname && m.speciesName) {
		fitText(ctx, m.speciesName, cx, y + 206, w - 32, 17, 500, MUTED);
	}

	// type pills
	ctx.font = `700 13px ${FONT}`;
	ctx.letterSpacing = "1px";
	const pills = m.types.map((t) => ({
		t,
		w: ctx.measureText(t.toUpperCase()).width + 18,
	}));
	const gap = 8;
	let px =
		cx - (pills.reduce((s, p) => s + p.w, 0) + gap * (pills.length - 1)) / 2;
	for (const p of pills) {
		ctx.fillStyle = TYPE_COLORS[p.t] ?? "#777";
		roundRect(ctx, px, y + 220, p.w, 22, 5);
		ctx.fill();
		ctx.fillStyle = "#fff";
		ctx.textAlign = "center";
		ctx.fillText(p.t.toUpperCase(), px + p.w / 2 + 0.5, y + 236);
		px += p.w + gap;
	}
	ctx.letterSpacing = "0px";

	fitText(ctx, `Met at ${m.metAt}`, cx, y + h - 18, w - 32, 14, 500, MUTED);
}

function drawFooter(ctx: CanvasRenderingContext2D, info: CardInfo) {
	const date = info.inductedAt.toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
	const parts = [
		`Inducted ${date}`,
		`${info.battlesWon} ${info.battlesWon === 1 ? "battle" : "battles"} won`,
		info.deaths === 0
			? "Deathless run"
			: `${info.deaths} fallen ${info.deaths === 1 ? "friend" : "friends"}`,
	];
	fitText(
		ctx,
		parts.join("   ·   "),
		CARD_WIDTH / 2,
		CARD_HEIGHT - 44,
		CARD_WIDTH - 160,
		18,
		500,
		GOLD,
	);
}

/** Draws the Hall of Fame card. Sprites are same-origin, so the canvas stays exportable. */
export async function drawHallOfFameCard(
	canvas: HTMLCanvasElement,
	info: CardInfo,
) {
	const sprites = await Promise.all(
		info.members.map((m) =>
			m.speciesId ? loadImage(`/sprites/${m.speciesId}.png`) : null,
		),
	);
	canvas.width = CARD_WIDTH;
	canvas.height = CARD_HEIGHT;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	drawBackground(ctx, info.inductedAt.getTime() % 2147483647);
	drawHeader(ctx, info);

	// up to 6 slots in a 3x2 grid; a smaller party is centred per row
	const cols = 3;
	const slotW = 340;
	const slotH = 280;
	const gapX = 30;
	const gapY = 20;
	const top = 182;
	const rows = Math.ceil(info.members.length / cols);
	info.members.forEach((m, i) => {
		const row = Math.floor(i / cols);
		const inRow = row === rows - 1 ? info.members.length - row * cols : cols;
		const rowW = inRow * slotW + (inRow - 1) * gapX;
		const x = (CARD_WIDTH - rowW) / 2 + (i % cols) * (slotW + gapX);
		const y =
			top + row * (slotH + gapY) + (rows === 1 ? (slotH + gapY) / 2 : 0);
		drawMember(ctx, m, sprites[i] ?? null, x, y, slotW, slotH);
	});

	drawFooter(ctx, info);
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
	canvas.toBlob((blob) => {
		if (!blob) return;
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	}, "image/png");
}
