import React from 'react';
import { flattenStyle } from './react-native';

export function Svg({
  children,
  width,
  height,
  viewBox,
  style,
  ...rest
}: Omit<React.SVGProps<SVGSVGElement>, 'style'> & { style?: unknown }) {
  return (
    <svg width={width} height={height} viewBox={viewBox} style={flattenStyle(style)} {...rest}>
      {children}
    </svg>
  );
}

export function G(props: React.SVGProps<SVGGElement>) {
  return <g {...props} />;
}

export function Circle(props: React.SVGProps<SVGCircleElement>) {
  return <circle {...props} />;
}

export function Ellipse(props: React.SVGProps<SVGEllipseElement>) {
  return <ellipse {...props} />;
}

export function Rect(props: React.SVGProps<SVGRectElement>) {
  return <rect {...props} />;
}

export function Line(props: React.SVGProps<SVGLineElement>) {
  return <line {...props} />;
}

export function Polyline(props: React.SVGProps<SVGPolylineElement>) {
  return <polyline {...props} />;
}

export function Polygon(props: React.SVGProps<SVGPolygonElement>) {
  return <polygon {...props} />;
}

export function Path(props: React.SVGProps<SVGPathElement>) {
  return <path {...props} />;
}

export function Text(props: React.SVGProps<SVGTextElement>) {
  return <text {...props} />;
}

export function Defs(props: React.SVGProps<SVGDefsElement>) {
  return <defs {...props} />;
}

export function LinearGradient(props: React.SVGProps<SVGLinearGradientElement>) {
  return <linearGradient {...props} />;
}

export function RadialGradient(props: React.SVGProps<SVGRadialGradientElement>) {
  return <radialGradient {...props} />;
}

export function Stop(props: React.SVGProps<SVGStopElement>) {
  return <stop {...props} />;
}

export function ClipPath(props: React.SVGProps<SVGClipPathElement>) {
  return <clipPath {...props} />;
}

export function Filter(props: React.SVGProps<SVGFilterElement>) {
  return <filter {...props} />;
}

export function FeGaussianBlur(props: React.SVGProps<SVGFEGaussianBlurElement>) {
  return <feGaussianBlur {...props} />;
}

export function FeMerge(props: React.SVGProps<SVGFEMergeElement>) {
  return <feMerge {...props} />;
}

export function FeMergeNode(props: React.SVGProps<SVGFEMergeNodeElement>) {
  return <feMergeNode {...props} />;
}

export default Svg;
