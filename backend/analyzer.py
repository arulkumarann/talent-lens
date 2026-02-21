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

# Explicitly pass API key — the SDK defaults to GOOGLE_API_KEY, not GEMINI_API_KEY
_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
gemini_client = genai.Client(api_key=_api_key)
GEMINI_FLASH = "gemini-2.5-flash"


def _gemini_text(system: str, user: str, max_tokens: int = 3000, retries: int = 3, json_mode: bool = False) -> str:
    """Call Gemini with retries and exponential back-off."""
    for attempt in range(retries):
        try:
            config_args = dict(
                system_instruction=system,
                max_output_tokens=max_tokens,
                temperature=0.2,
            )
            if json_mode:
                config_args["response_mime_type"] = "application/json"
            response = gemini_client.models.generate_content(
                model=GEMINI_FLASH,
                contents=user,
                config=types.GenerateContentConfig(**config_args),
            )
            text = response.text or ""
            if text:
                return text
            print(f"    [Analyzer] Empty Gemini response (attempt {attempt + 1}/{retries})")
        except Exception as e:
            print(f"    [Analyzer] Gemini API error (attempt {attempt + 1}/{retries}): {e}")
        if attempt < retries - 1:
            wait = 3 * (attempt + 1)
            print(f"    [Analyzer] Retrying in {wait}s...")
            time.sleep(wait)
    return ""


def _parse_json_from_text(text: str):
    """
    Robust JSON parser that handles:
    - Clean JSON
    - Markdown ```json ... ``` blocks
    - Truncated code blocks (missing closing ```)
    - Truncated JSON (missing closing braces)
    """
    if not text or not text.strip():
        return None

    # Strategy 1: Direct parse (works when response_mime_type is set)
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Strategy 2: Extract from markdown code block (```json ... ```)
    for marker in ("```json", "```"):
        if marker in text:
            s = text.find(marker) + len(marker)
            # Skip optional newline after marker
            if s < len(text) and text[s] == '\n':
                s += 1
            e = text.find("```", s)
            # If closing ``` is missing (truncated), take everything after marker
            block = text[s:e].strip() if e != -1 else text[s:].strip()
            try:
                return json.loads(block)
            except json.JSONDecodeError:
                repaired = _repair_json(block)
                if repaired is not None:
                    return repaired

    # Strategy 3: Find first { and try to parse from there
    m = re.search(r'\{', text)
    if m:
        candidate = text[m.start():]
        # Remove any trailing ``` that might be after the JSON
        candidate = re.sub(r'```\s*$', '', candidate).strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            repaired = _repair_json(candidate)
            if repaired is not None:
                return repaired

    return None


def _repair_json(text: str):
    """Try to repair truncated JSON by closing open braces/brackets."""
    text = text.strip()
    if not text.startswith('{'):
        return None

    # Remove trailing commas
    text = re.sub(r',\s*$', '', text)

    # Count open vs close braces/brackets
    open_braces = text.count('{') - text.count('}')
    open_brackets = text.count('[') - text.count(']')

    # If balanced, try parsing directly
    if open_braces == 0 and open_brackets == 0:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

    # Try to close truncated JSON
    repaired = text.rstrip()

    # Fix unbalanced quotes (truncated string)
    if repaired.count('"') % 2 != 0:
        last_quote = repaired.rfind('"')
        repaired = repaired[:last_quote + 1]

    # Remove trailing comma
    repaired = re.sub(r',\s*$', '', repaired)

    # Close brackets then braces
    repaired += ']' * max(0, open_brackets)
    repaired += '}' * max(0, open_braces)

    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
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
                            f"Evaluate this design project titled '{work_title}' "
                            f"by a designer with skills in: {skills_text}. "
                            f"The user searched for '{focus_area}'. "
                            f"Focus your analysis on: "
                            f"1) Overall visual design quality and aesthetics (most important), "
                            f"2) Creativity and originality of the design, "
                            f"3) Technical execution and polish, "
                            f"4) Whether this level of design talent could produce great work in the '{focus_area}' domain. "
                            f"IMPORTANT: Do NOT penalize the designer for not having prior experience in '{focus_area}'. "
                            f"Great designers can transfer their skills across domains. "
                            f"Judge the QUALITY of design work shown, not whether it matches the search domain exactly."
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
        f"You are a brutally honest, elite-level design critic evaluating UI/UX designers' portfolios. "
        f"The user searched for '{focus_area}' — this is a KEYWORD describing the UI/UX design DOMAIN they need. "
        f"For example, if the keyword is 'car', the user wants UI/UX designers who create CAR-related digital experiences "
        f"(car rental apps, automotive dashboards, vehicle configurators, car dealership websites, EV charging UIs, etc). "
        f"The keyword '{focus_area}' is NOT about the designer's job title — ALL candidates are UI/UX designers. "
        f"It IS about whether their portfolio shows relevant work in the '{focus_area}' domain.\n\n"
        "You have image-by-image analyses of their actual design work. "
        "Produce a comprehensive evaluation as a JSON object.\n\n"
        "STRICT SCORING RULES — YOU MUST FOLLOW THESE:\n"
        "1. Be HARSH and CRITICAL. A score of 3.0/5.0 means 'average'. Most designers are average.\n"
        "2. Reserve 4.5+ ratings ONLY for truly world-class, award-winning caliber work.\n"
        "3. Score 4.0-4.4 means 'very good but not exceptional'.\n"
        "4. Score 3.0-3.9 means 'competent, professional, but unremarkable'.\n"
        "5. Score below 3.0 means 'below expectations for a professional'.\n"
        "6. overall_score mapping: 85+ = elite/HIRE, 60-84 = decent/CONSIDER, below 60 = weak/REJECT.\n"
        "7. Do NOT inflate scores because of high follower counts alone — followers can be bought.\n"
        "8. DEMAND concrete evidence of design excellence from the actual images analyzed.\n"
        "9. Generic, template-looking, or derivative designs should score 2.5-3.5 max.\n"
        "10. Only give HIRE recommendation if overall_score >= 85.\n"
        "11. REJECT if overall_score < 60 or if design quality is genuinely poor.\n"
        "12. CONSIDER for everything in between (60-84).\n"
        f"13. 'specialization_alignment' measures how well their UI/UX work aligns with '{focus_area}' — "
        f"a designer who has done car rental app UIs scores high for 'car', even if they also do other domains.\n"
        "14. KEEP ALL reasoning and feedback strings VERY SHORT — 1-2 sentences max per field. Be concise.\n"
    )

    user_prompt = f"""Evaluate this UI/UX designer's portfolio and return ONLY a valid JSON object.
The user is looking for UI/UX designers in the '{focus_area}' domain. Be STRICT — most designers should score 55-75.

REMEMBER: '{focus_area}' is the DOMAIN keyword. All candidates are UI/UX designers.
Judge: (1) quality of their UI/UX design work, (2) relevance to the '{focus_area}' domain.

{{
  "overall_rating": <float 1.0-5.0>,
  "overall_score": <int 20-100>,
  "metrics": {{
    "design_excellence": {{ "rating": <float>, "reasoning": "1-2 sentences" }},
    "ux_mastery": {{ "rating": <float>, "reasoning": "1-2 sentences" }},
    "industry_expertise": {{ "rating": <float>, "reasoning": "1-2 sentences" }},
    "technical_sophistication": {{ "rating": <float>, "reasoning": "1-2 sentences" }},
    "innovation_creativity": {{ "rating": <float>, "reasoning": "1-2 sentences" }},
    "specialization_alignment": {{ "rating": <float>, "reasoning": "1-2 sentences" }},
    "market_positioning": {{ "rating": <float>, "reasoning": "1-2 sentences" }}
  }},
  "strengths": ["short", "short", "short"],
  "areas_for_improvement": ["short", "short"],
  "recommendation": {{
    "decision": "HIRE|CONSIDER|REJECT",
    "confidence": "HIGH|MEDIUM|LOW",
    "reasoning": "1-2 sentences",
    "suitable_roles": ["Role"]
  }},
  "detailed_feedback": {{
    "what_stands_out": "1 sentence",
    "biggest_concerns": "1 sentence",
    "growth_potential": "1 sentence",
    "industry_fit": "1 sentence"
  }}
}}

SCORING GUIDELINES:
- Average professional UI/UX designer = overall_score 55-65
- Good designer with solid portfolio = 65-75  
- Very talented with standout work = 75-84
- Elite, world-class portfolio = 85+
- Do NOT give 85+ unless the work is genuinely exceptional and you have strong evidence.

DESIGNER DATA:
{json.dumps(portfolio_context, indent=2, default=str)}"""

    try:
        print(f"  [Analyzer] Generating final assessment for {username}...")
        result_text = _gemini_text(system, user_prompt, max_tokens=8192, retries=3, json_mode=True)

        if not result_text:
            print(f"  [Analyzer] WARNING: Gemini returned empty response for {username} after all retries")
        else:
            parsed = _parse_json_from_text(result_text)

            if isinstance(parsed, dict):
                if "overall_score" not in parsed:
                    parsed["overall_score"] = round((parsed.get("overall_rating", 2.5) / 5.0) * 100)
                print(f"  [Analyzer] Score: {parsed.get('overall_score', '?')} — {parsed.get('recommendation', {}).get('decision', '?')}")
                return parsed
            else:
                print(f"  [Analyzer] WARNING: Could not parse JSON from Gemini response for {username}")
                print(f"  [Analyzer] Raw response (first 500 chars): {result_text[:500]}")
    except Exception as e:
        print(f"  [Analyzer] Error generating assessment for {username}: {e}")

    # Fallback
    print(f"  [Analyzer] Using fallback analysis for {username}")
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
