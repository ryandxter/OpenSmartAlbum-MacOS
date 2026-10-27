; ====================================================================
; OpenSmartAlbum NSIS Installer Customization
; Modern Professional Flow, License Policy & Success Alert
; ====================================================================

!macro NSIS_HOOK_PREINSTALL
  ; Display Open Source License & Offline Privacy Guarantee confirmation before installing
  MessageBox MB_YESNO|MB_ICONINFORMATION "OpenSmartAlbum$\r$\nProfessional Photo Album & Social Media Carousel Studio$\r$\n$\r$\n100% Free & Open-Source Software.$\r$\n$\r$\n[100% OFFLINE & PRIVACY GUARANTEE]$\r$\nAll photos, albums, and metadata remain strictly on your local computer.$\r$\nZero cloud uploads or external telemetry.$\r$\n$\r$\nDo you wish to proceed with installation?" IDYES agree_license
  Abort
  agree_license:
  DetailPrint "License accepted by user."
  DetailPrint "Installing OpenSmartAlbum..."
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Configuring desktop shortcuts and file associations..."
  DetailPrint "Registering project file types..."
  DetailPrint "OpenSmartAlbum installation completed successfully."
  MessageBox MB_OK|MB_ICONINFORMATION "Installation Successful!$\r$\n$\r$\nOpenSmartAlbum is now installed on your computer.$\r$\n$\r$\nDesktop shortcuts and project associations (.afsn, .opensmartalbum) are ready to use."
!macroend
