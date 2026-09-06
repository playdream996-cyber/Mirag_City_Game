import { SceneLoader } from "@babylonjs/core";

const FALLBACK_TEXTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlKx5QAAAAASUVORK5CYII=";

export function installCityAssetFallback(): () => void {
  const observer = SceneLoader.OnPluginActivatedObservable.add((plugin: unknown) => {
    const loader = plugin as {
      name?: string;
      preprocessUrlAsync?: (url: string) => Promise<string>;
    };

    if (loader.name !== "gltf") return;

    const previous = loader.preprocessUrlAsync?.bind(loader);
    loader.preprocessUrlAsync = async (url: string): Promise<string> => {
      if (/\.(png|jpg|jpeg|webp)$/i.test(url)) return FALLBACK_TEXTURE;
      return previous ? previous(url) : url;
    };
  });

  return () => {
    SceneLoader.OnPluginActivatedObservable.remove(observer);
  };
}
