def nx_post_install (installer)
    Pod::UI.info("[Nx] Updating build settings to support custom port")
    installer.pods_project.targets.each do |target|
      if ['React', 'React-Core'].include?(target.name)
        target.build_configurations.each do |build_configuration|
          if build_configuration.name == 'Debug'
            gcc_preprocessor_defs = build_configuration.build_settings['GCC_PREPROCESSOR_DEFINITIONS']
            gcc_preprocessor_defs ||= %w($(inherited) COCOAPODS=1 DEBUG=1)
            gcc_preprocessor_defs << 'RCT_METRO_PORT=${RCT_METRO_PORT}' unless gcc_preprocessor_defs.include?('RCT_METRO_PORT')
            build_configuration.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = gcc_preprocessor_defs
          end
        end
      end
    end
  end
