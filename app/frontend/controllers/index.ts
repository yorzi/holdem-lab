import { Application } from '@hotwired/stimulus'
import DisclosureController from './disclosure_controller'
import LessonSessionController from './lesson_session_controller'
import LocaleSwitchController from './locale_switch_controller'

const application = Application.start()
application.debug = false
application.register('disclosure', DisclosureController)
application.register('lesson-session', LessonSessionController)
application.register('locale-switch', LocaleSwitchController)

export { application }
