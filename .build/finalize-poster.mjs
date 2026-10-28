import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const skill='C:/Users/wagks/.codex/plugins/cache/openai-primary-runtime/presentations/26.1022.11436/skills/presentations';
const { finalizePresentation } = await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
const workspaceDir='C:/Workspace/KoreanEye';
const finalPath=path.join(workspaceDir,'output','한글탐정단_프로젝트_포스터.pptx');
const stagingDir=path.join(workspaceDir,'.build','.codex-finalizer');
await fs.mkdir(stagingDir,{recursive:true});
const result=await finalizePresentation({
 explicitTotalSlideCount:1,
 requiredNativeTableOwnerSlides:[],
 requiredNativeChartOwnerSlides:[],
 workspaceDir,
 candidatePath:path.join(workspaceDir,'.build','koreaneye-poster-draft.pptx'),
 finalPath,
 pythonExecutable:'C:/Users/wagks/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
 integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),
 layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
 layoutArgs:['--expected-slide-size-emu','25203150,50406300','--validate-bullet-geometry','--validate-heading-fit'],
 fontPolicy:{basis:'design',families:['Malgun Gothic']},
 verifyArtifactToolImport:true,
 receiptPath:path.join(stagingDir,'poster.validation.json'),
});
console.log(JSON.stringify(result,null,2));
