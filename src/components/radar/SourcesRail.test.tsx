import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SourcesRail } from "./SourcesRail";
import type { RadarGroup } from "./useRadarFeed";

const group = (over: Partial<RadarGroup> = {}): RadarGroup => ({
  key: "Lair",
  name: "Lair",
  iconUrl: "https://cdn.discordapp.com/icons/1/old.png",
  count: 10,
  subgroups: [],
  ...over,
});

describe("SourcesRail — ícone do servidor", () => {
  it("mostra a imagem enquanto ela carrega", () => {
    const { container } = render(
      <SourcesRail groups={[group()]} selection={null} onSelect={() => {}} />,
    );
    expect(container.querySelector("img[src*='old.png']")).not.toBeNull();
  });

  it("imagem que falha (404) cai na inicial do servidor", () => {
    const { container } = render(
      <SourcesRail groups={[group()]} selection={null} onSelect={() => {}} />,
    );
    fireEvent.error(container.querySelector("img[src*='old.png']")!);
    expect(container.querySelector("img[src*='old.png']")).toBeNull();
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  it("sem ícone: inicial direto", () => {
    render(<SourcesRail groups={[group({ iconUrl: null })]} selection={null} onSelect={() => {}} />);
    expect(screen.getByText("L")).toBeInTheDocument();
  });
});
