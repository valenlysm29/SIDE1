import {test,expect} from '@playwright/test';
test('el registro local explica la clave docente y distingue perfiles',async({page})=>{
 await page.goto('http://127.0.0.1:4178');
 await page.getByRole('button',{name:'EMPEZAR'}).click();
 await page.getByRole('button',{name:/Profesor/}).click();
 await page.getByRole('button',{name:/Crear cuenta/}).click();
 const form=page.locator('#register');
 await expect(form.locator('#register-email-label')).toHaveText('Correo institucional');
 await expect(form.locator('#register-email-help')).toContainText('clave de registro docente');
 await expect(form.locator('#register-email-help')).toContainText('@upch.pe');
 await form.locator('[name=role]').selectOption('student');
 await expect(form.locator('#register-email-label')).toHaveText('Correo');
 await expect(form.locator('#register-email-help')).toHaveText('');
});
