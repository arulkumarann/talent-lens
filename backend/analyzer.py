"""
TalentLens — Gemini-Based Portfolio Analyzer
=============================================
Takes scraped designer data + locally saved images and produces
talent scores, metrics, and hiring recommendations using Gemini.
"""

import os
import json
import base64
import time
import re
from typing import List, Dict, Optional

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

gemini_client = genai.Client()
GEMINI_FLASH = "gemini-2.5-flash"


def _gemini_text(system: str, user: str, max_tokens: int = 3000) -> str:
    response = gemini_client.models.generate_content(
        model=GEMINI_FLASH,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_tokens,
            temperature=0.2,
        ),
    )
    return response.text or ""


def _parse_json_from_text(text: str):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    if "```json" in text:
        s = text.find("```json") + 7
        e = text.find("```", s)
        try:
            return json.loads(text[s:e].strip())
        except Exception:
            pass
    if "```" in text:
        s = text.find("```") + 3
        e = text.find("```", s)
        try:
            return json.loads(text[s:e].strip())
        except Exception:
            pass
    m = re.search(r'\{.*\}', text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except Exception:
            pass
    return None


def _load_image_as_base64(filepath: str) -> Optional[str]:
    """Load a local image file and return its base64 encoding."""
    try:
        if not os.path.exists(filepath):
            return None
        with open(filepath, "rb") as f:
            data = f.read()
        if len(data) < 1000:
            return None
        return base64.b64encode(data).decode("utf-8")
    except Exception:
        return None


def _detect_mime_type(filepath: str) -> str:
    ext = os.path.splitext(filepath)[1].lower()
    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    return mime_map.get(ext, "image/jpeg")


def analyze_image(filepath: str, work_title: str, skills: List[str], focus_area: str) -> Optional[str]:
    """
    Analyze a single design image using Gemini Flash vision.
    Returns text analysis of the design.
    """
    b64 = _load_image_as_base64(filepath)
    if not b64:
        print(f"    [Analyzer] Could not load image: {filepath}")
        return None

    mime = _detect_mime_type(filepath)
    skills_text = ", ".join(skills) if skills else "general design"

    try:
        response = gemini_client.models.generate_content(
            model=GEMINI_FLASH,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=
                            f"Critically evaluate this {focus_area} design project titled '{work_title}' "
                            f"by a designer specializing in: {skills_text}. "
                            f"Provide a concise analysis covering: visual design quality, "
                            f"UX/interaction design, technical sophistication, creativity, "
                            f"and relevance to {focus_area}. Be specific about what you see."
                        ),
                        types.Part.from_bytes(
                            data=base64.b64decode(b64),
                            mime_type=mime,
                        ),
                    ],
                )
            ],
            config=types.GenerateContentConfig(
                max_output_tokens=600,
                temperature=0.2,
            ),
        )
        return response.text or None
    except Exception as e:
        print(f"    [Analyzer] Vision error: {e}")
        return None


def analyze_designer(designer: Dict, focus_area: str) -> Dict:
    """
    Produce a full talent analysis for a single designer using Gemini.
    Analyzes their downloaded images, then produces scores and recommendation.
    """
    username = designer.get("username", "unknown")
    name = designer.get("name", username)
    print(f"  [Analyzer] Analyzing {username}...")

    # ── Analyze each downloaded image ─────────────────────────────────────────
    image_analyses = []
    shots = designer.get("shots", [])
    skills = designer.get("skills", [])

    for i, shot in enumerate(shots):
        abs_path = shot.get("absolute_path", "")
        if not abs_path or not os.path.exists(abs_path):
            continue

        print(f"    [Analyzer] Analyzing image {i + 1}/{len(shots)}: {shot.get('title', '?')}")
        analysis = analyze_image(abs_path, shot.get("title", "Untitled"), skills, focus_area)
        if analysis:
            image_analyses.append({
                "title": shot.get("title", ""),
                "analysis": analysis,
            })
        time.sleep(2)

    # ── Generate overall assessment ───────────────────────────────────────────
    skills_text = ", ".join(skills) if skills else "general design"
    followers = designer.get("metrics", {}).get("followers_count", "unknown")
    location = designer.get("location", "unknown")
    bio = designer.get("bio", "")

    portfolio_context = {
        "name": name,
        "username": username,
        "location": location,
        "bio": bio,
        "skills": skills,
        "followers": followers,
        "images_analyzed": len(image_analyses),
        "image_analyses": image_analyses,
    }

    system = (
        f"You are a senior design recruiter evaluating a {focus_area} designer's portfolio. "
        "You have image-by-image analyses of their work. "
        "Produce a comprehensive evaluation as a JSON object."
    )

    user_prompt = f"""Evaluate this designer's portfolio for {focus_area} work and return ONLY a valid JSON object:

{{
  "overall_rating": <float 1.0-5.0>,
  "overall_score": <integer 20-100>,
  "metrics": {{
    "design_excellence": {{ "rating": <float 1.0-5.0>, "reasoning": "..." }},
    "ux_mastery": {{ "rating": <float 1.0-5.0>, "reasoning": "..." }},
    "industry_expertise": {{ "rating": <float 1.0-5.0>, "reasoning": "..." }},
    "technical_sophistication": {{ "rating": <float 1.0-5.0>, "reasoning": "..." }},
    "innovation_creativity": {{ "rating": <float 1.0-5.0>, "reasoning": "..." }},
    "specialization_alignment": {{ "rating": <float 1.0-5.0>, "reasoning": "..." }},
    "market_positioning": {{ "rating": <float 1.0-5.0>, "reasoning": "..." }}
  }},
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "areas_for_improvement": ["area 1", "area 2"],
  "recommendation": {{
    "decision": "HIRE" or "CONSIDER" or "REJECT",
    "confidence": "HIGH" or "MEDIUM" or "LOW",
    "reasoning": "...",
    "suitable_roles": ["Role 1", "Role 2"]
  }},
  "detailed_feedback": {{
    "what_stands_out": "...",
    "biggest_concerns": "...",
    "growth_potential": "...",
    "industry_fit": "..."
  }}
}}

DESIGNER DATA:
{json.dumps(portfolio_context, indent=2, default=str)}"""

    try:
        print(f"  [Analyzer] Generating final assessment for {username}...")
        result_text = _gemini_text(system, user_prompt, max_tokens=3000)
        parsed = _parse_json_from_text(result_text)

        if isinstance(parsed, dict):
            if "overall_score" not in parsed:
                parsed["overall_score"] = round((parsed.get("overall_rating", 2.5) / 5.0) * 100)
            print(f"  [Analyzer] Score: {parsed.get('overall_score', '?')} — {parsed.get('recommendation', {}).get('decision', '?')}")
            return parsed
    except Exception as e:
        print(f"  [Analyzer] Error generating assessment: {e}")

    # Fallback
    return {
        "overall_rating": 2.5,
        "overall_score": 50,
        "metrics": {
            "design_excellence": {"rating": 2.5, "reasoning": "Analysis failed"},
            "ux_mastery": {"rating": 2.5, "reasoning": "Analysis failed"},
            "industry_expertise": {"rating": 2.5, "reasoning": "Analysis failed"},
            "technical_sophistication": {"rating": 2.5, "reasoning": "Analysis failed"},
            "innovation_creativity": {"rating": 2.5, "reasoning": "Analysis failed"},
            "specialization_alignment": {"rating": 2.5, "reasoning": "Analysis failed"},
            "market_positioning": {"rating": 2.5, "reasoning": "Analysis failed"},
        },
        "strengths": ["Manual review required"],
        "areas_for_improvement": ["Analysis failed"],
        "recommendation": {
            "decision": "CONSIDER",
            "confidence": "LOW",
            "reasoning": "Automated analysis failed — manual review needed",
            "suitable_roles": ["Unknown"],
        },
        "detailed_feedback": {
            "what_stands_out": "Analysis failed",
            "biggest_concerns": "System error",
            "growth_potential": "Unknown",
            "industry_fit": "Unknown",
        },
    }


def analyze_all_designers(scraped_data: Dict, focus_area: str) -> List[Dict]:
    """
    Take the output of run_scraper() and produce analyzed profiles
    in the format the TalentLens frontend expects.
    """
    designers = scraped_data.get("designers", [])
    print(f"\n[Analyzer] Analyzing {len(designers)} designers for '{focus_area}'...")

    processed = []
    for designer in designers:
        username = designer.get("username", "")

        # Run analysis
        analysis = analyze_designer(designer, focus_area)

        # Flatten social links into a list of URLs
        social_links_dict = designer.get("social_links", {})
        flat_links = []
        if isinstance(social_links_dict, dict):
            for key, val in social_links_dict.items():
                if key == "other" and isinstance(val, list):
                    flat_links.extend([v for v in val if v])
                elif isinstance(val, str) and val:
                    flat_links.append(val)

        # Build the profile object the frontend expects
        profile = {
            "original_data": {
                "name": designer.get("name", ""),
                "username": username,
                "location": designer.get("location", ""),
                "bio": designer.get("bio", ""),
                "followers_count": designer.get("metrics", {}).get("followers_count", "0"),
                "specializations": designer.get("skills", []),
                "social_links": flat_links,
                "contact": designer.get("contact", {}),
                "profile_url": designer.get("profile_url", ""),
            },
            "final_analysis": analysis,
            "relevant_works": [
                {
                    "id": str(i),
                    "title": shot.get("title", ""),
                    "images": [
                        {
                            "original_url": shot.get("original_url", ""),
                            "local_path": shot.get("local_path", ""),
                        }
                    ],
                }
                for i, shot in enumerate(designer.get("shots", []))
            ],
            "social_media_links": flat_links,
            "processed_at": designer.get("scraped_at", ""),
        }
        processed.append(profile)
        time.sleep(3)

    print(f"[Analyzer] Done. {len(processed)} profiles analyzed.")
    return processed
