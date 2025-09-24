class ConceptExtractionService {
  extractConcepts(analysisData) {
    if (!analysisData) return [];

    const concepts = (analysisData.keyConcepts || []).map((key, index) => ({
      id: `concept_${index + 1}`,
      name: key,
      description: `Detailed explanation of ${key}. Refer to topic: ${analysisData.topic}.`,
      difficulty: this.estimateDifficulty(key, analysisData.difficulty),
      prerequisites: this.findPrerequisites(key, analysisData.prerequisites),
      subConcepts: this.generateSubConcepts(key),
      examples: this.generateExamples(key),
      misconceptions: this.generateCommonMisconceptions(key),
      keyPrinciples: this.generateKeyPrinciples(key),
      estimatedTime: this.estimateTime(key),
      bloomsLevel: this.estimateBloomsLevel(key),
      extractedAt: new Date().toISOString(),
      sourceSubject: analysisData.subject,
      sourceTopic: analysisData.topic,
      masteryLevel: 0,
      attempts: 0,
      correctAnswers: 0,
    }));

    return concepts;
  }

  createLearningPathway(concepts) {
    if (!concepts?.length) return { pathway: [], totalEstimatedTime: "0 min" };

    const sortedConcepts = this.sortConceptsByDependency(concepts);
    const totalMinutes = sortedConcepts.reduce((total, c) => total + this.parseTimeToMinutes(c.estimatedTime), 0);

    return {
      pathway: sortedConcepts.map((c, index) => ({
        ...c,
        order: index + 1,
        isUnlocked: index === 0,
        dependencies: this.findDependencies(c, sortedConcepts),
      })),
      totalEstimatedTime: this.formatMinutesToTime(totalMinutes),
      totalConcepts: sortedConcepts.length,
      difficultyDistribution: this.calculateDifficultyDistribution(sortedConcepts),
    };
  }

  sortConceptsByDependency(concepts) {
    const difficultyOrder = { Beginner: 1, Intermediate: 2, Advanced: 3 };
    return [...concepts].sort((a, b) => {
      const diffA = difficultyOrder[a.difficulty] || 2;
      const diffB = difficultyOrder[b.difficulty] || 2;
      if (diffA !== diffB) return diffA - diffB;
      return (a.prerequisites?.length || 0) - (b.prerequisites?.length || 0);
    });
  }

  findDependencies(concept, allConcepts) {
    if (!concept?.prerequisites?.length) return [];
    return allConcepts.filter((other) => other.id !== concept.id && concept.prerequisites.some((p) => other.name.toLowerCase().includes(p.toLowerCase()) || other.subConcepts?.some((sub) => sub.toLowerCase().includes(p.toLowerCase())))).map((dep) => dep.id);
  }

  calculateDifficultyDistribution(concepts) {
    const dist = { Beginner: 0, Intermediate: 0, Advanced: 0 };
    concepts.forEach((c) => {
      if (dist.hasOwnProperty(c.difficulty)) dist[c.difficulty]++;
    });
    return dist;
  }

  parseTimeToMinutes(timeStr) {
    if (!timeStr) return 15;
    const match = timeStr.match(/(\d+)\s*(min|hour|hr)/i);
    if (!match) return 15;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    return unit.includes("hour") || unit.includes("hr") ? value * 60 : value;
  }

  formatMinutesToTime(minutes) {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours} hour${hours > 1 ? "s" : ""}` : `${hours}h ${mins}min`;
  }

  // -------------------------
  // Heuristic generators
  // -------------------------
  estimateDifficulty(name, defaultDifficulty = "Intermediate") {
    if (/intro|basics|fundamentals/i.test(name)) return "Beginner";
    if (/advanced|complex/i.test(name)) return "Advanced";
    return defaultDifficulty;
  }

  findPrerequisites(name, allPrereqs = []) {
    return allPrereqs.filter((p) => name.toLowerCase().includes(p.toLowerCase()));
  }

  generateSubConcepts(name) {
    return name.split(" ").slice(0, 2);
  }

  generateExamples(name) {
    return [`Example of ${name} in real-world context.`];
  }

  generateCommonMisconceptions(name) {
    return [`Common misconception about ${name}.`];
  }

  generateKeyPrinciples(name) {
    return [`Key principle related to ${name}.`];
  }

  estimateTime(name) {
    if (/advanced/i.test(name)) return "20 min";
    if (/intermediate/i.test(name)) return "15 min";
    return "10 min";
  }

  estimateBloomsLevel(name) {
    if (/understand|know/i.test(name)) return "Understand";
    if (/apply|use/i.test(name)) return "Apply";
    return "Remember";
  }
}

export default new ConceptExtractionService();
