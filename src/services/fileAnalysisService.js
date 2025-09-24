import * as pdfjsLib from "pdfjs-dist/webpack";

class FileAnalysisService {
  async analyzeFile(file) {
    if (!file) throw new Error("No file provided");

    const validation = this.validateFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const fileContent = await this._extractFileContent(file);

    const lines = fileContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const subject = file.name.split(".")[0];
    const topic = lines[0] || subject;

    // Difficulty: average sentence length heuristic
    const sentences = fileContent.match(/[^.!?]+[.!?]/g) || [];
    const avgWords = sentences.length ? sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length : 0;
    const difficulty = avgWords > 20 ? "Advanced" : avgWords > 12 ? "Intermediate" : "Beginner";

    // Key concepts: top 10 frequent words excluding stopwords
    const stopwords = new Set(["the", "and", "of", "to", "a", "in", "for", "is", "on", "with", "as", "by", "an"]);
    const words = fileContent.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    const freqMap = {};
    words.forEach((w) => {
      if (!stopwords.has(w)) freqMap[w] = (freqMap[w] || 0) + 1;
    });
    const keyConcepts = Object.entries(freqMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w);

    const learningObjectives = lines.filter((l) => /objective/i.test(l)).slice(0, 5);
    const prerequisites = lines.filter((l) => /prerequisite|requirement/i.test(l)).slice(0, 5);

    const estimatedTime = `${Math.ceil(words.length / 200)} minutes`;
    const summary = lines.slice(0, 5).join(" ");

    return {
      subject,
      topic,
      difficulty,
      keyConcepts,
      learningObjectives,
      prerequisites,
      estimatedTime,
      summary,
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      },
      rawContent: fileContent,
      analyzedAt: new Date().toISOString(),
    };
  }

  async _extractFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          if (file.type.includes("application/pdf")) {
            const pdf = await pdfjsLib.getDocument(event.target.result).promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              fullText += textContent.items.map((item) => item.str).join(" ") + "\n";
            }
            resolve(fullText);
          } else {
            resolve(event.target.result);
          }
        } catch (error) {
          reject(new Error("Failed to extract file content"));
        }
      };

      reader.onerror = () => reject(new Error("Failed to read file"));

      if (file.type === "application/pdf") reader.readAsArrayBuffer(file);
      else reader.readAsText(file);
    });
  }

  validateFile(file) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ["text/plain", "text/markdown", "application/json", "text/csv", "application/pdf"];

    if (!file) {
      return { isValid: false, error: "No file provided" };
    }
    if (file.size > maxSize) {
      return { isValid: false, error: "File size exceeds 10MB limit" };
    }
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: "Unsupported file type" };
    }

    return { isValid: true, error: null }; // ✅ Return object for consistent handling
  }
}

export default new FileAnalysisService();
