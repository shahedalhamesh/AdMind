import { usePortalTheme } from "../../services/portalTheme";

// The "the AI is working" indicator: a glowing core with three dots orbiting it.
export default function AiOrb({ size = 30 }: { size?: number }) {
  const { p } = usePortalTheme();
  return (
    <span className="ai-orb" aria-hidden style={{ color: p.ai, width: size, height: size }}>
      <i /><i /><i />
    </span>
  );
}