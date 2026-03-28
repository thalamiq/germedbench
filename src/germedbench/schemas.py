from pydantic import BaseModel


class Diagnosis(BaseModel):
    code: str  # Primary ICD-10-GM code, e.g. "I21.0"
    acceptable_codes: list[str] = []  # Alternative codes that are also correct
    display: str = ""  # German display name (resolved from catalog if empty)
    typ: str  # "Hauptdiagnose" or "Nebendiagnose"

    @property
    def all_codes(self) -> list[str]:
        """Primary code + all acceptable alternatives."""
        return [self.code] + self.acceptable_codes


class ICD10Case(BaseModel):
    id: str
    fachbereich: str  # e.g. "Kardiologie", "Innere Medizin"
    text: str  # Clinical discharge text (Kurzepikrise)
    diagnosen: list[Diagnosis]


class StructuredSummary(BaseModel):
    hauptdiagnose: str
    therapie: str
    procedere: str
    offene_fragen: str


class SummarizationCase(BaseModel):
    id: str
    fachbereich: str
    komplexitaet: str  # "einfach", "mittel", "komplex"
    text: str  # Full discharge letter (Entlassbrief)
    gold_summary: StructuredSummary


class DifferentialDiagnosis(BaseModel):
    name: str  # German diagnosis name, e.g. "Akuter Myokardinfarkt"
    icd10_code: str = ""  # Optional ICD-10-GM code
    likelihood: str  # "hoch", "mittel", "gering"
    key_findings: list[str]  # Supporting findings from the vignette


class ClinicalReasoningCase(BaseModel):
    id: str
    fachbereich: str
    schwierigkeitsgrad: str  # "einfach", "mittel", "komplex"
    text: str  # Clinical vignette (200-400 words)
    gold_diagnoses: list[DifferentialDiagnosis]  # Ranked DDx, most likely first
    correct_diagnosis: str  # Confirmed final diagnosis name
    correct_diagnosis_icd10: str = ""


class ClinicalEntity(BaseModel):
    typ: str  # "diagnose", "prozedur", "medikament", "laborwert"
    name: str  # Surface form, e.g. "Vorhofflimmern"
    code: str = ""  # ICD-10 or OPS code (diagnose/prozedur)
    wirkstoff: str = ""  # Active ingredient (medikament)
    dosierung: str = ""  # Dosage string (medikament)
    parameter: str = ""  # Lab parameter name (laborwert)
    wert: str = ""  # Lab value (laborwert)
    einheit: str = ""  # Unit (laborwert/medikament)


class NERCase(BaseModel):
    id: str
    fachbereich: str
    text: str  # Discharge letter excerpt (200-400 words)
    entities: list[ClinicalEntity]


class MedicationEntry(BaseModel):
    wirkstoff: str  # Active ingredient, e.g. "Metoprolol"
    dosis: str  # Dosage, e.g. "47.5 mg"
    frequenz: str  # Frequency, e.g. "1-0-0", "2x täglich"
    darreichungsform: str = ""  # Route/form, e.g. "p.o.", "i.v.", "Tablette"


class MedExtCase(BaseModel):
    id: str
    fachbereich: str
    text: str  # Clinical free text with medication mentions
    medications: list[MedicationEntry]
