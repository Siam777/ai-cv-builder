"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";

export function PhotoUploader({
  value,
  disabled,
  templateName,
  photoSupported,
  photoHidden,
  onChange,
  onSwitchDesign,
  onKeepDesign,
}: {
  value: string;
  disabled: boolean;
  templateName: string;
  photoSupported: boolean;
  photoHidden: boolean;
  onChange: (value: string) => void;
  onSwitchDesign?: () => void;
  onKeepDesign: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );

  async function loadPhoto(file?: File) {
    if (!file) return;
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Choose a JPG, PNG or WebP photo smaller than 5 MB.");
      return;
    }
    const id = ++generation.current;
    setWorking(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Photo loading timed out.")),
          10000,
        );
        image.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        image.onerror = () => {
          clearTimeout(timer);
          reject(new Error("This file could not be opened as a photo."));
        };
        image.src = url;
      });
      if (id !== generation.current) return;
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 320 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error(
          "Photo processing is unavailable. Try another browser.",
        );
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      onChange(canvas.toDataURL("image/jpeg", 0.85));
    } catch (error) {
      if (id === generation.current) setError((error as Error).message);
    } finally {
      URL.revokeObjectURL(url);
      if (id === generation.current) setWorking(false);
    }
  }

  return (
    <section
      id="contact-photo"
      className="photo-upload-section"
      aria-label="Resume photo"
    >
      <div className="photo-preview-circle">
        {value ? (
          <img
            src={value}
            alt="Your resume photo"
            className="avatar-thumbnail"
          />
        ) : (
          <Camera className="avatar-placeholder" size={28} aria-hidden />
        )}
      </div>
      <div className="photo-upload-actions">
        <h3 className="photo-label">
          Add a photo <span>(optional)</span>
        </h3>
        <p className="photo-hint">
          Choose a JPG, PNG or WebP, up to 5 MB. Only some designs show a
          photo. Word and text exports leave it out.
        </p>
        <div className="photo-buttons-row">
          <button
            type="button"
            disabled={disabled || working}
            onClick={() => input.current?.click()}
          >
            {working
              ? "Preparing photo…"
              : value
                ? "Change photo"
                : "Upload photo"}
          </button>
          {value && (
            <button
              type="button"
              disabled={disabled || working}
              onClick={() => onChange("")}
            >
              Remove photo
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          aria-label="Choose resume photo"
          onChange={(event) => {
            void loadPhoto(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {error && (
          <p role="alert" className="account-error">
            {error}
          </p>
        )}
        {value && !photoSupported && !photoHidden && (
          <div className="photo-design-warning" role="status">
            <p>
              Your current design ({templateName}) doesn&apos;t show photos.
            </p>
            <div className="photo-buttons-row">
              {onSwitchDesign && (
                <button
                  type="button"
                  className="primary"
                  disabled={disabled}
                  onClick={onSwitchDesign}
                >
                  Switch to a photo design
                </button>
              )}
              <button type="button" disabled={disabled} onClick={onKeepDesign}>
                Keep design without photo
              </button>
            </div>
          </div>
        )}
        {value && photoSupported && !photoHidden && (
          <p role="status" className="helper-text">
            Photo added. It shows on your CV preview.
          </p>
        )}
        {value && photoHidden && (
          <p role="status" className="helper-text">
            Photo saved but hidden on your CV. Upload it again or turn on the
            photo in Design to show it.
          </p>
        )}
      </div>
    </section>
  );
}
