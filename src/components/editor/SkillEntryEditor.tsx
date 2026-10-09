"use client";

import { useState, useRef, useEffect, useMemo, useId } from "react";
import { type Entry } from "@/lib/document";
import { Field } from "./Field";
import {
  type SkillCategory,
  type TaxonomySkill,
  SKILL_CATEGORIES,
  searchSkillsTaxonomy,
  parseSkillsFromText,
  addSkillToText,
  removeSkillFromText,
  formatSkillsList,
} from "@/lib/skills-taxonomy";

export interface SkillEntryEditorProps {
  entry: Entry;
  disabled?: boolean;
  onChange: (fields: Partial<Entry>) => void;
}

export function SkillEntryEditor({
  entry,
  disabled = false,
  onChange,
}: SkillEntryEditorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showRawText, setShowRawText] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownListId = useId();

  // Infer category from entry.title if possible, or fallback to first matching category
  const activeCategory = useMemo<SkillCategory | undefined>(() => {
    const titleLower = (entry.title || "").toLowerCase();
    for (const cat of SKILL_CATEGORIES) {
      if (
        titleLower.includes(cat.id.replace("_", " ")) ||
        titleLower.includes(cat.label.toLowerCase()) ||
        cat.popularSkills.some((s) => titleLower.includes(s.toLowerCase()))
      ) {
        return cat.id;
      }
    }
    return undefined;
  }, [entry.title]);

  const [selectedCategory, setSelectedCategory] = useState<
    SkillCategory | undefined
  >(activeCategory);

  useEffect(() => {
    if (activeCategory && !selectedCategory) {
      setSelectedCategory(activeCategory);
    }
  }, [activeCategory, selectedCategory]);

  // Current parsed skills from description
  const currentSkills = useMemo(
    () => parseSkillsFromText(entry.description),
    [entry.description],
  );

  // Search results
  const searchResults = useMemo<TaxonomySkill[]>(() => {
    if (!searchQuery.trim()) {
      if (selectedCategory) {
        return searchSkillsTaxonomy("", {
          category: selectedCategory,
          limit: 8,
        });
      }
      return searchSkillsTaxonomy("", { limit: 8 });
    }
    return searchSkillsTaxonomy(searchQuery, {
      category: selectedCategory,
      limit: 10,
    });
  }, [searchQuery, selectedCategory]);

  // Popular suggestions for current category that are not yet added
  const suggestions = useMemo(() => {
    const cat = SKILL_CATEGORIES.find((c) => c.id === (selectedCategory || "frontend"));
    if (!cat) return [];
    const currentLower = new Set(currentSkills.map((s) => s.toLowerCase()));
    return cat.popularSkills.filter((s) => !currentLower.has(s.toLowerCase()));
  }, [selectedCategory, currentSkills]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleAddSkill(skillName: string) {
    const trimmed = skillName.trim();
    if (!trimmed) return;
    const updated = addSkillToText(entry.description, trimmed);
    onChange({ description: updated });
    setSearchQuery("");
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  }

  function handleRemoveSkill(skillName: string) {
    const updated = removeSkillFromText(entry.description, skillName);
    onChange({ description: updated });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsDropdownOpen(true);
      setHighlightedIndex((prev) =>
        prev < searchResults.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
        handleAddSkill(searchResults[highlightedIndex].name);
      } else if (searchQuery.trim()) {
        handleAddSkill(searchQuery.trim());
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  }

  function handleSelectCategoryPreset(catMeta: (typeof SKILL_CATEGORIES)[0]) {
    setSelectedCategory(catMeta.id);
    if (!entry.title || entry.title === "New entry" || entry.title === "Skills") {
      onChange({ title: catMeta.label });
    }
  }

  return (
    <div className="skill-entry-editor" ref={containerRef}>
      {/* Category Preset Chips */}
      <div className="skill-category-presets" role="group" aria-label="Skill categories">
        <span className="preset-label">Category:</span>
        <div className="preset-chips-scroll">
          {SKILL_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`skill-category-pill ${isSelected ? "selected" : ""}`}
                disabled={disabled}
                onClick={() => handleSelectCategoryPreset(cat)}
                aria-pressed={isSelected}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Autocomplete Search Bar */}
      <div className="skill-search-container">
        <div className="skill-search-input-wrapper">
          <span className="search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            ref={searchInputRef}
            type="text"
            className="skill-search-input"
            disabled={disabled}
            placeholder={
              selectedCategory
                ? `Search ${SKILL_CATEGORIES.find((c) => c.id === selectedCategory)?.label} skills (e.g. React, Docker)...`
                : "Search or type any skill to add (e.g. TypeScript, Python)..."
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(e.target.value.trim().length > 0);
              setHighlightedIndex(-1);
            }}
            onFocus={() => {
              if (searchQuery.trim().length > 0) {
                setIsDropdownOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            aria-autocomplete="list"
            aria-controls={dropdownListId}
            aria-expanded={isDropdownOpen}
            aria-label="Search skills"
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setSearchQuery("");
                setIsDropdownOpen(false);
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Dropdown Suggestions */}
        {isDropdownOpen && (searchResults.length > 0 || searchQuery.trim().length > 0) && (
          <ul
            id={dropdownListId}
            className="skill-autocomplete-dropdown"
            role="listbox"
          >
            {searchResults.map((skill, index) => {
              const alreadyAdded = currentSkills.some(
                (s) => s.toLowerCase() === skill.name.toLowerCase(),
              );
              const isHighlighted = index === highlightedIndex;
              const catMeta = SKILL_CATEGORIES.find((c) => c.id === skill.category);

              return (
                <li
                  key={skill.id}
                  id={`skill-option-${skill.id}`}
                  role="option"
                  aria-selected={isHighlighted}
                  className={`skill-dropdown-item ${isHighlighted ? "highlighted" : ""} ${alreadyAdded ? "already-added" : ""}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => {
                    if (!alreadyAdded) {
                      handleAddSkill(skill.name);
                    }
                  }}
                >
                  <div className="skill-info">
                    <span className="skill-name">{skill.name}</span>
                    {catMeta && (
                      <span className="skill-cat-badge">
                        {catMeta.icon} {catMeta.label}
                      </span>
                    )}
                  </div>
                  {alreadyAdded ? (
                    <span className="skill-added-tag">✓ Added</span>
                  ) : (
                    <span className="skill-add-action">+ Add</span>
                  )}
                </li>
              );
            })}
            {searchQuery.trim() &&
              !searchResults.some(
                (s) =>
                  s.name.toLowerCase() === searchQuery.trim().toLowerCase(),
              ) && (
                <li
                  role="option"
                  aria-selected={highlightedIndex === searchResults.length}
                  className="skill-dropdown-item custom-add"
                  onClick={() => handleAddSkill(searchQuery.trim())}
                >
                  <span>
                    Add custom skill: <strong>“{searchQuery.trim()}”</strong>
                  </span>
                  <span className="skill-add-action">+ Add</span>
                </li>
              )}
          </ul>
        )}
      </div>

      {/* Active Skills Tag Chips */}
      <div className="active-skills-container">
        <div className="active-skills-header">
          <label className="active-skills-label">
            Added Skills ({currentSkills.length})
          </label>
        </div>

        {currentSkills.length === 0 ? (
          <p className="no-skills-notice">
            No skills added yet. Search above, click recommendations, or type in the description below.
          </p>
        ) : (
          <div className="skill-chips-cloud" role="list" aria-label="Added skills">
            {currentSkills.map((skill) => (
              <span key={skill} className="skill-chip" role="listitem">
                <span className="skill-chip-text">{skill}</span>
                <button
                  type="button"
                  className="skill-chip-remove"
                  disabled={disabled}
                  aria-label={`Remove ${skill}`}
                  onClick={() => handleRemoveSkill(skill)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Quick Recommendations Cloud */}
      {suggestions.length > 0 && (
        <div className="suggested-skills-cloud">
          <span className="suggested-label">Recommended:</span>
          <div className="suggested-chips">
            {suggestions.slice(0, 8).map((s) => (
              <button
                key={s}
                type="button"
                className="suggested-chip-btn"
                disabled={disabled}
                onClick={() => handleAddSkill(s)}
                title={`Add ${s}`}
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Description Field & Format Actions */}
      <div className="skill-description-wrapper">
        <Field
          label="Description"
          value={entry.description}
          multiline
          placeholder="e.g. React · TypeScript · Node.js · PostgreSQL"
          onChange={(v) => onChange({ description: v })}
        />
        {currentSkills.length > 1 && (
          <div className="raw-actions">
            <button
              type="button"
              className="btn-format-sm"
              onClick={() => {
                const formatted = formatSkillsList(currentSkills, " · ");
                onChange({ description: formatted });
              }}
            >
              Format with dots ( · )
            </button>
            <button
              type="button"
              className="btn-format-sm"
              onClick={() => {
                const formatted = formatSkillsList(currentSkills, ", ");
                onChange({ description: formatted });
              }}
            >
              Format with commas ( , )
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
