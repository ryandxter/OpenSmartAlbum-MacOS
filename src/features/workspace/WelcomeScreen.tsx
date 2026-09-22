import { useEffect, useState } from 'react';
import { Plus, FolderOpen, Clock, Image, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useProjectStore } from '../../stores/projectStore';
import { useAppStore } from '../../stores/appStore';
import { Project } from '../../domain/project';
import { formatDimensions } from '../../domain/units';
import appIcon from '../../assets/app-icon.png';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  const openNewProject = useProjectStore((s) => s.openNewProject);
  const recentProjects = useProjectStore((s) => s.recentProjects);
  const loadRecentProjects = useProjectStore((s) => s.loadRecentProjects);
  const openProjectById = useProjectStore((s) => s.openProjectById);
  const removeRecentProject = useProjectStore((s) => s.removeRecentProject);
  const clearAllRecentProjects = useProjectStore((s) => s.clearAllRecentProjects);
  const appInfo = useAppStore((s) => s.appInfo);

  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [missingFileProject, setMissingFileProject] = useState<Project | null>(null);
  const [missingProjectIds, setMissingProjectIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRecentProjects();
  }, [loadRecentProjects]);

  useEffect(() => {
    let isMounted = true;
    const checkMissingFiles = async () => {
      const missing = new Set<string>();
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        for (const proj of recentProjects) {
          if (proj.filePath) {
            try {
              const exists = await invoke<boolean>('check_path_exists', { path: proj.filePath });
              if (!exists) {
                missing.add(proj.id);
              }
            } catch {}
          }
        }
      } catch {}
      if (isMounted) {
        setMissingProjectIds(missing);
      }
    };

    if (recentProjects.length > 0) {
      checkMissingFiles();
    }
    return () => {
      isMounted = false;
    };
  }, [recentProjects]);

  const handleOpenProject = async (proj: Project) => {
    if (proj.filePath) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const exists = await invoke<boolean>('check_path_exists', { path: proj.filePath });
        if (!exists) {
          setMissingFileProject(proj);
          return;
        }
      } catch {}
    }
    openProjectById(proj.id);
  };

  return (
    <div className={styles.welcomeContainer}>
      <div className={styles.welcomeCard}>
        {/* Left Side: Pro Studio Branding Column */}
        <div className={styles.heroColumn}>
          <div className={styles.studioBranding}>
            <div className={styles.logoIcon}>
              <img src={appIcon} alt="OpenSmartAlbum Icon" className={styles.appLogoImg} />
            </div>

            <div className={styles.heroTextGroup}>
              <h1 className={styles.heroTitle}>OpenSmartAlbum</h1>
              <p className={styles.heroSubtitle}>
                Professional offline desktop photo album layout and social media publishing studio.
              </p>
            </div>

            <div className={styles.featureHighlights}>
              <div className={styles.featureItem}>
                <span className={styles.featureDot}>•</span>
                <span>Print-ready spreads, TIFF, PDF/X & layered PSD</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureDot}>•</span>
                <span>Instagram multi-slide seamless carousel slicing</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureDot}>•</span>
                <span>Canva-style vector shapes & non-destructive masks</span>
              </div>
            </div>

            <div className={styles.heroFooter}>
              <span>Version {appInfo.version} · macOS Native</span>
            </div>
          </div>
        </div>

        {/* Right Side: Actions & Recent Projects List */}
        <div className={styles.contentColumn}>
          <div className={styles.contentHeader}>
            <h2 className={styles.welcomeHeading}>Get Started</h2>
            <p className={styles.welcomeSubheading}>
              Start a new photo album project or seamlessly resume your recent work.
            </p>
          </div>

          {/* Action Buttons */}
          <div className={styles.actionsGroup}>
            <Button
              variant="primary"
              size="md"
              className={styles.primaryActionButton}
              onClick={openNewProject}
            >
              <Plus size={16} strokeWidth={1.5} />
              <span>Create New Project</span>
            </Button>

            <Button
              variant="secondary"
              size="md"
              className={styles.secondaryActionButton}
              onClick={async () => {
                await useProjectStore.getState().importProjectFromAfsn();
              }}
              title="Open an .afsn project. Extract ZIP packages first, then open project.afsn."
            >
              <FolderOpen size={16} strokeWidth={1.5} />
              <span>Open Project</span>
            </Button>
          </div>

          {/* Recent Projects Section */}
          <div className={styles.recentSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <Clock size={14} strokeWidth={1.5} />
                <span>Recent Projects</span>
                {recentProjects.length > 0 && (
                  <span className={styles.countBadge}>{recentProjects.length}</span>
                )}
              </div>
              {recentProjects.length > 0 && (
                <button
                  type="button"
                  className={styles.clearAllBtn}
                  onClick={() => setIsClearAllDialogOpen(true)}
                  title="Clear all recent projects from history"
                >
                  Clear History
                </button>
              )}
            </div>

            {recentProjects.length > 0 ? (
              <div className={styles.recentList}>
                {recentProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className={styles.recentItem}
                    onClick={() => handleOpenProject(proj)}
                    title={missingProjectIds.has(proj.id) ? `Project file missing from disk: ${proj.filePath}` : `Open ${proj.name}`}
                  >
                    <div className={styles.projectIconBadge}>
                      <Image size={16} strokeWidth={1.5} />
                    </div>
                    <div className={styles.projectInfo}>
                      <span className={styles.projectName}>{proj.name}</span>
                      <span className={styles.projectDetails}>
                        {formatDimensions(proj.canvasWidth, proj.canvasHeight, proj.canvasUnit)} • {proj.canvasDpi} DPI
                      </span>
                    </div>
                    <div className={styles.itemRight}>
                      {!proj.filePath && (
                        <span className={styles.missingBadge} title="Local recovery data. Open this project and use Save As to create a project file.">
                          Not Saved to File
                        </span>
                      )}
                      {missingProjectIds.has(proj.id) && (
                        <span className={styles.missingBadge} title="Original .afsn file was not found on disk">
                          Missing File
                        </span>
                      )}
                      <span className={styles.projectDate}>
                        {new Date(proj.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <button
                        type="button"
                        className={styles.deleteItemBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(proj);
                        }}
                        title="Remove from recent list"
                        aria-label="Remove"
                      >
                        <X size={12} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>
                  <FolderOpen size={32} strokeWidth={1.5} />
                </div>
                <span>No recent albums yet. Click above to create your first layout!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Confirmation Dialog: Clear All History */}
      <ConfirmDialog
        isOpen={isClearAllDialogOpen}
        title="Clear Recent Projects"
        message="Are you sure you want to clear all projects from the recent list?"
        detail="This will remove the projects from the internal database. Your original photo files and any exported .afsn files on your computer remain completely safe."
        confirmText="Clear History"
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          await clearAllRecentProjects();
          setIsClearAllDialogOpen(false);
        }}
        onCancel={() => setIsClearAllDialogOpen(false)}
      />

      {/* Modern Confirmation Dialog: Remove Single Project */}
      <ConfirmDialog
        isOpen={projectToDelete !== null}
        title="Remove From Recent List"
        message={`Remove "${projectToDelete?.name}" from your recent projects?`}
        detail="This will remove this project from the internal database. Your original photo files and any exported .afsn files on disk remain safe."
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (projectToDelete) {
            await removeRecentProject(projectToDelete.id);
            setProjectToDelete(null);
          }
        }}
        onCancel={() => setProjectToDelete(null)}
      />

      {/* Modern Recovery Dialog: Missing .afsn File */}
      <ConfirmDialog
        isOpen={missingFileProject !== null}
        title="Project File Not Found"
        message={`The file for "${missingFileProject?.name}" was moved or deleted.`}
        detail={`Original location: ${missingFileProject?.filePath || 'Unknown'}\n\nYou can restore this album layout from the local cache. When you save, you will be asked to choose a file location.`}
        confirmText="Open from Local Cache"
        cancelText="Cancel"
        secondaryText="Remove from List"
        secondaryVariant="danger"
        variant="warning"
        onConfirm={async () => {
          if (missingFileProject) {
            const pid = missingFileProject.id;
            setMissingFileProject(null);
            openProjectById(pid);
          }
        }}
        onSecondary={async () => {
          if (missingFileProject) {
            const pid = missingFileProject.id;
            setMissingFileProject(null);
            await removeRecentProject(pid);
          }
        }}
        onCancel={() => setMissingFileProject(null)}
      />
    </div>
  );
}
