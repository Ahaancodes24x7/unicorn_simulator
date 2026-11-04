// 25×19 pixel-art unicorn drawn as SVG rects. Two leg frames alternate to make it gallop.
type R = [x: number, y: number, w: number, h: number];

const BODY: R[] = [
  [5, 10, 14, 5], [6, 15, 12, 1], [17, 9, 3, 5], [16, 6, 4, 4], [15, 8, 2, 2],
  [18, 4, 5, 3], [20, 7, 4, 2], [23, 6, 1, 2], [18, 3, 1, 1],
];
const MANE: R[] = [[15, 4, 3, 1], [14, 5, 2, 1], [13, 6, 2, 1], [14, 7, 2, 1], [13, 8, 2, 1], [17, 3, 1, 1], [4, 10, 1, 2], [2, 9, 2, 2], [1, 11, 2, 2], [0, 13, 2, 2], [3, 8, 2, 1]];
const HORN: R[] = [[20, 3, 1, 1], [21, 2, 1, 1], [22, 1, 1, 1], [23, 0, 1, 1]];
const EYE: R[] = [[20, 5, 1, 1]];
const LEGS_A: R[] = [[18, 15, 2, 1], [19, 16, 2, 1], [20, 17, 2, 1], [21, 18, 1, 1], [16, 15, 1, 3], [16, 18, 2, 1], [6, 15, 1, 1], [5, 16, 1, 1], [4, 17, 1, 1], [3, 18, 2, 1], [8, 15, 1, 3], [8, 18, 2, 1]];
const LEGS_B: R[] = [[17, 15, 1, 2], [16, 17, 1, 1], [15, 18, 2, 1], [14, 15, 1, 3], [13, 18, 2, 1], [7, 15, 1, 2], [8, 17, 1, 1], [9, 18, 2, 1], [10, 15, 1, 3], [11, 18, 2, 1]];

function Pixels({ rects, fill, px }: { rects: R[]; fill: string; px: number }) {
  return (
    <>
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} x={x * px} y={y * px} width={w * px} height={h * px} fill={fill} />
      ))}
    </>
  );
}

export function PixelUnicorn({ x, y, px = 6, color = "#8df59a" }: { x: number; y: number; px?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={{ animation: "run-across 5s ease-in-out infinite" }}>
        {/* sparkle trail */}
        {[0, 1, 2].map((i) => (
          <rect key={i} x={0} y={(9 + i * 2) * px} width={px} height={px} fill={color}
            style={{ animation: `sparkle 1.2s ${i * 0.35}s linear infinite`, transformBox: "fill-box" }} />
        ))}
        <g style={{ animation: "bob 0.36s steps(2) infinite" }}>
          <Pixels rects={BODY} fill={color} px={px} />
          <Pixels rects={MANE} fill="#4fc766" px={px} />
          <Pixels rects={HORN} fill="#e6ffe6" px={px} />
          <Pixels rects={EYE} fill="#062010" px={px} />
          <g style={{ animation: "gallop-a 0.36s infinite" }}><Pixels rects={LEGS_A} fill={color} px={px} /></g>
          <g style={{ animation: "gallop-b 0.36s infinite" }}><Pixels rects={LEGS_B} fill={color} px={px} /></g>
        </g>
      </g>
    </g>
  );
}
